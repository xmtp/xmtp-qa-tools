import fs from "fs";
import { appendFile } from "fs/promises";
import path from "path";
import {
  formatBytes,
  generateEncryptionKeyHex,
  getVersionConfig,
  nodeVersionOptions,
  sleep,
  VersionList,
} from "@helpers/client";
import { type Client, type Group, type XmtpEnv } from "@xmtp/node-sdk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { installationThreshold, WorkerClient, type typeofStream } from "./main";

// Deprecated: Use getWorkers with count and options instead
export const getFixedNames = (count: number): string[] => {
  return [...defaultNames].slice(0, count);
};

// Deprecated: Use getWorkers with count and options instead
export const getRandomNames = (count: number): string[] => {
  return [...defaultNames].sort(() => Math.random() - 0.5).slice(0, count);
};

// Deprecated: Use getWorkers with useVersions option instead
export function getWorkersWithVersions(workerNames: string[]): string[] {
  const testVersions = parseInt(process.env.TEST_VERSIONS ?? "1");

  if (!testVersions) {
    // No versions specified, return names as-is (will use latest version)
    return workerNames;
  }

  const availableVersions = nodeVersionOptions().slice(0, testVersions);

  const descriptors: string[] = [];
  for (const workerName of workerNames) {
    // Pick a random version from the specified list
    const randomVersion =
      availableVersions[Math.floor(Math.random() * availableVersions.length)];

    // If workerName already contains installation ID (has dash), don't add another "-a"
    if (workerName.includes("-")) {
      descriptors.push(`${workerName}-${randomVersion}`);
    } else {
      descriptors.push(`${workerName}-a-${randomVersion}`);
    }
  }

  return descriptors;
}
export interface WorkerBase {
  name: string;
  sdk: string;
  folder: string;
  walletKey: string;
  encryptionKey: string;
  sdkVersion: string;
  libXmtpVersion: string;
}

export interface Worker extends WorkerBase {
  worker: WorkerClient;
  dbPath: string;
  client: Client;
  installationId: string;
  inboxId: string;
  env: XmtpEnv;
  folder: string;
  address: string;
}

/**
 * WorkerManager: A unified class for managing workers and their lifecycle
 * Combines the functionality of both WorkerManager and WorkerFactory
 */
export class WorkerManager {
  private workers: Record<string, Record<string, Worker>>;
  private activeWorkers: WorkerClient[] = [];
  private env: XmtpEnv;
  private keysCache: Record<
    string,
    { walletKey: string; encryptionKey: string }
  > = {};

  /**
   * Constructor creates an empty manager or populates it with existing workers
   */
  constructor(env: XmtpEnv) {
    this.env = env;
    this.workers = {};
  }
  /**
   * Terminates all active workers and cleans up resources
   */
  public async terminateAll(deleteDbs: boolean = false): Promise<void> {
    console.debug(`Terminating ${this.activeWorkers.length} workers`);
    const terminationPromises = this.activeWorkers.map(
      async (worker: WorkerClient) => {
        try {
          // await worker.client.clearAllStatistics();
          await worker.terminate();
          if (deleteDbs) {
            await worker.clearDB();
          }
        } catch (error) {
          console.warn(`Error terminating worker:`, error);
        }
      },
    );

    await Promise.all(terminationPromises);
    this.activeWorkers = [];
    this.workers = {};
    await sleep(500);
  }

  /**
   * Gets the total number of workers
   */
  public getLength(): number {
    let count = 0;
    for (const baseName in this.workers) {
      count += Object.keys(this.workers[baseName]).length;
    }
    return count;
  }

  /**
   * Gets a random subset of workers
   */
  public getRandomWorkers(count: number): Worker[] {
    const allWorkers = this.getAll();
    return allWorkers.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  public getRandomWorker(): Worker {
    const allWorkers = this.getAll();
    return allWorkers[Math.floor(Math.random() * allWorkers.length)];
  }

  /**
   * Gets the version of the first worker (as a representative version)
   */
  public getVersion(): string {
    const firstBaseName = Object.keys(this.workers)[0];
    if (!firstBaseName) return "unknown";

    const firstInstallId = Object.keys(this.workers[firstBaseName])[0];
    if (!firstInstallId) return "unknown";

    return this.workers[firstBaseName][firstInstallId].sdkVersion;
  }

  public checkStatistics(): void {
    // for (const worker of this.getAll()) {
    //   console.debug(JSON.stringify(worker.client.apiStatistics(), null, 2));
    // }
  }
  public async checkForks(): Promise<void> {
    for (const worker of this.getAll()) {
      const groups = await worker.client.conversations.list();
      await Promise.all(
        groups.flat().map(async (g) => {
          const debugInfo = await g.debugInfo();
          if (debugInfo.maybeForked) {
            throw new Error(`Stopping test, group id ${g.id} may have forked`);
          }
        }),
      );
    }
  }
  public async checkForksForGroup(groupId: string): Promise<bigint> {
    for (const worker of this.getAll()) {
      const group =
        await worker.client.conversations.getConversationById(groupId);
      if (!group) {
        console.warn(
          `Group ${groupId} not found for worker ${worker.name}, skipping...`,
        );
        continue;
      }

      await group.sync();
      const debugInfo = await group.debugInfo();
      const members = await group.members();
      let totalGroupInstallations = 0;
      for (const member of members)
        totalGroupInstallations += member.installationIds.length;

      if (debugInfo.maybeForked) {
        const logMessage = `Fork detected, group id ${groupId} may have forked, epoch ${debugInfo.epoch} for worker ${worker.name}`;
        console.error(logMessage);
        throw new Error(logMessage);
      }
      const currentEpoch = debugInfo.epoch;
      if (currentEpoch % 10n === 0n) {
        console.log(
          `Worker ${worker.name} - Epoch: ${currentEpoch} - Members: ${members.length} - Installations: ${totalGroupInstallations}`,
        );
      }
    }

    return 0n;
  }
  //lo
  public async revokeExcessInstallations(
    threshold: number = installationThreshold,
  ) {
    const workers = this.getAll();
    for (const worker of workers) {
      await worker.worker.revokeExcessInstallations(threshold);
    }
  }
  public async printWorkers() {
    try {
      let workersToPrint = [];
      for (const baseName in this.workers) {
        for (const installationId in this.workers[baseName]) {
          const currentWorker = this.workers[baseName][installationId];
          const installationCount =
            await currentWorker.client.preferences.inboxState();
          workersToPrint.push(
            `${this.env}:${baseName}-${installationId} ${currentWorker.address} ${currentWorker.sdkVersion}-${currentWorker.libXmtpVersion} ${installationCount.installations.length} - ${formatBytes(
              (await currentWorker.worker.getSQLiteFileSizes())?.total ?? 0,
            )}`,
          );
        }
      }

      console.debug(JSON.stringify(workersToPrint, null, 2));
    } catch (error) {
      console.error(error);
    }
  }
  getCreator(): Worker {
    const workers = this.getAll();
    return workers[0];
  }
  getReceiver(): Worker {
    const workers = this.getAll();
    const creator = this.getCreator();
    const otherWorkers = workers.filter((worker) => worker !== creator);
    return otherWorkers[Math.floor(Math.random() * otherWorkers.length)];
  }
  async createGroupBetweenAll(
    groupName: string = `Test Group ${Math.random().toString(36).substring(2, 15)}`,
    members: string[] | null = null,
  ): Promise<Group> {
    const creator = this.getCreator();
    const memberList = members
      ? members.map((name) => {
          const worker = this.get(name);
          if (!worker) throw new Error(`Worker not registered: ${name}`);
          return worker.client.inboxId;
        })
      : this.getAllButCreator().map((worker) => worker.client.inboxId);

    const group = await creator.client.conversations.newGroup(memberList, {
      groupName,
    });

    return group as Group;
  }

  getAllBut(excludeName: string): Worker[] {
    const workers = this.getAll();
    return workers.filter((worker) => worker.name !== excludeName);
  }
  getAllButCreator(): Worker[] {
    const workers = this.getAll();
    const creator = this.getCreator();
    return workers.filter((worker) => worker.name !== creator.name);
  }

  startStream(streamType: typeofStream) {
    for (const worker of this.getAll()) {
      worker.worker.startStream(streamType);
    }
  }

  /**
   * Gets all workers as a flat array
   */
  public getAll(): Worker[] {
    const allWorkers: Worker[] = [];
    for (const baseName in this.workers) {
      for (const installationId in this.workers[baseName]) {
        allWorkers.push(this.workers[baseName][installationId]);
      }
    }
    return allWorkers;
  }

  /**
   * Gets a specific worker by name and optional installation ID
   */
  public get(
    baseName: string,
    installationId: string = "a",
  ): Worker | undefined {
    if (baseName.includes("-")) {
      const parts = baseName.split("-");
      const name = parts[0];
      const id = parts[1];
      return this.workers[name]?.[id];
    }
    return this.workers[baseName]?.[installationId];
  }

  /**
   * Adds a worker to the manager
   */
  public addWorker(
    baseName: string,
    installationId: string,
    worker: Worker,
  ): void {
    if (!this.workers[baseName]) {
      this.workers[baseName] = {};
    }
    this.workers[baseName][installationId] = worker;
  }

  /**
   * Ensures a worker has wallet and encryption keys
   * Either retrieves from env vars or generates new ones
   */
  private ensureKeys(name: string): {
    walletKey: string;
    encryptionKey: string;
  } {
    // Extract the base name without installation ID for key lookup
    const baseName = name.split("-")[0];

    if (baseName in this.keysCache) {
      console.debug(`Using cached keys for ${baseName}`);
      return this.keysCache[baseName];
    }

    const walletKeyEnv = `WALLET_KEY_${baseName.toUpperCase()}`;
    const encryptionKeyEnv = `ENCRYPTION_KEY_${baseName.toUpperCase()}`;

    // Check if keys exist in environment variables
    if (
      process.env[walletKeyEnv] !== undefined &&
      process.env[encryptionKeyEnv] !== undefined
    ) {
      this.keysCache[baseName] = {
        walletKey: process.env[walletKeyEnv],
        encryptionKey: process.env[encryptionKeyEnv],
      };

      return this.keysCache[baseName];
    }

    // Keys don't exist, generate new ones
    console.debug(`Generating new keys for ${baseName}`);
    const walletKey = generatePrivateKey();
    const account = privateKeyToAccount(walletKey);
    const encryptionKey = generateEncryptionKeyHex();
    const publicKey = account.address;

    // Store in cache
    this.keysCache[baseName] = {
      walletKey,
      encryptionKey,
    };

    // Update process.env directly so subsequent calls in the same process will find the keys
    process.env[walletKeyEnv] = walletKey;
    process.env[encryptionKeyEnv] = encryptionKey;

    if (!name.includes("random")) {
      // Append to .env file for persistence across runs
      const filePath =
        process.env.CURRENT_ENV_PATH || path.resolve(process.cwd(), ".env");
      void appendFile(
        filePath,
        `\n${walletKeyEnv}=${walletKey}\n${encryptionKeyEnv}=${encryptionKey}\n# public key is ${publicKey}\n`,
      );
    }

    return this.keysCache[baseName];
  }

  /**
   * Creates a new worker with all necessary initialization
   */
  public async createWorker(
    descriptor: string,
    apiUrl?: string,
  ): Promise<Worker> {
    const parts = descriptor.split("-");
    const baseName = parts[0];

    // Handle version parsing - version is always the last part if it's a number
    let sdkVersion = getLatestVersion();
    let providedInstallId: string | undefined;

    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      // Check if last part is a valid SDK version
      if (
        lastPart &&
        [
          "0.0.13",
          "0.0.47",
          "1.0.5",
          "2.0.9",
          "2.1.0",
          "2.2.0",
          "3.0.1",
        ].includes(lastPart)
      ) {
        sdkVersion = lastPart;
        // Installation ID is everything between baseName and version
        if (parts.length > 2) {
          providedInstallId = parts.slice(1, -1).join("-");
        }
      } else {
        // No version specified, everything after baseName is installation ID
        providedInstallId = parts.slice(1).join("-");
      }
    }

    // Check if the worker already exists in our internal storage
    if (providedInstallId && this.workers[baseName]?.[providedInstallId]) {
      console.debug(`Reusing existing worker for ${descriptor}`);
      return this.workers[baseName][providedInstallId];
    }

    // Determine folder/installation ID
    const folder = providedInstallId || getNextFolderName();
    const libXmtpVersion = getLibxmtpVersion(sdkVersion);

    // Get or generate keys
    const { walletKey, encryptionKey } = this.ensureKeys(baseName);

    // Create the base worker data
    const workerData: WorkerBase = {
      name: baseName,
      sdk: sdkVersion + "-" + libXmtpVersion,
      folder,
      walletKey,
      encryptionKey,
      sdkVersion: sdkVersion,
      libXmtpVersion: libXmtpVersion,
    };

    // Create and initialize the worker
    const workerClient = new WorkerClient(workerData, this.env, {}, apiUrl);

    const initializedWorker = await workerClient.initialize();

    // Create the complete worker
    const worker: Worker = {
      ...workerData,
      client: initializedWorker.client,
      inboxId: initializedWorker.client.inboxId,
      dbPath: initializedWorker.dbPath,
      sdkVersion: sdkVersion,
      libXmtpVersion: libXmtpVersion,
      address: initializedWorker.address,
      installationId: initializedWorker.client.installationId,
      env: this.env,
      folder,
      worker: workerClient,
    };

    // Store the new worker for potential cleanup later
    this.activeWorkers.push(workerClient);

    // Add to our internal storage
    this.addWorker(baseName, folder, worker);

    return worker;
  }
}

/**
 * Factory function to create a WorkerManager with initialized workers
 */
export async function getWorkers(
  descriptorsOrMap: string[] | Record<string, string> | number,
  options: {
    env?: XmtpEnv;
    useVersions?: boolean;
    randomNames?: boolean;
  } = {},
): Promise<WorkerManager> {
  const { useVersions = true, randomNames = true } = options;
  const env = options.env || (process.env.XMTP_ENV as XmtpEnv) || "dev";
  const manager = new WorkerManager(env);

  let workerPromises: Promise<Worker>[] = [];

  // Handle different input types
  if (typeof descriptorsOrMap === "number") {
    // Number input - generate worker names based on mode
    const count = descriptorsOrMap;
    let names: string[];

    if (randomNames) {
      names = getRandomNames(count);
    } else {
      names = getFixedNames(count);
    }

    // Apply versioning if requested
    const descriptors = useVersions ? getWorkersWithVersions(names) : names;

    workerPromises = descriptors.map((descriptor) =>
      manager.createWorker(descriptor),
    );
  } else if (Array.isArray(descriptorsOrMap)) {
    // Array input - apply versioning if requested
    const descriptors = useVersions
      ? getWorkersWithVersions(descriptorsOrMap)
      : descriptorsOrMap;

    workerPromises = descriptors.map((descriptor) =>
      manager.createWorker(descriptor),
    );
  } else {
    // Record input - apply versioning if requested
    let entries = Object.entries(descriptorsOrMap);

    if (useVersions) {
      const versionedKeys = getWorkersWithVersions(
        Object.keys(descriptorsOrMap),
      );
      entries = versionedKeys.map((key, index) => [
        key,
        Object.values(descriptorsOrMap)[index],
      ]);
    }

    workerPromises = entries.map(([descriptor, apiUrl]) =>
      manager.createWorker(descriptor, apiUrl),
    );
  }

  await Promise.all(workerPromises);
  await manager.printWorkers();
  await manager.revokeExcessInstallations();

  return manager;
}

// Default worker names
export const defaultNames = [
  "bob",
  "alice",
  "fabri",
  "elon",
  "joe",
  "charlie",
  "dave",
  "eve",
  "frank",
  "grace",
  "henry",
  "ivy",
  "jack",
  "karen",
  "larry",
  "mary",
  "nancy",
  "oscar",
  "paul",
  "quinn",
  "rachel",
  "steve",
  "tom",
  "ursula",
  "victor",
  "wendy",
  "xavier",
  "yolanda",
  "zack",
  "adam",
  "bella",
  "carl",
  "diana",
  "eric",
  "fiona",
  "george",
  "hannah",
  "ian",
  "julia",
  "keith",
  "lisa",
  "mike",
  "nina",
  "oliver",
  "penny",
  "quentin",
  "rosa",
  "sam",
  "tina",
  "walt",
  "uma",
  "vince",
  "xena",
  "yara",
  "zara",
  "guada", // max 61
];

/**
 * Helper function to get worker names array from a WorkerManager
 * Always returns names in the same order (sorted by creation order)
 */
export function getWorkerNames(workers: WorkerManager): string[] {
  return workers.getAll().map((worker) => worker.name);
}

/**
 * Helper function to get the next available folder name
 */
function getNextFolderName(): string {
  const dataPath = path.resolve(process.cwd(), ".data");
  let folder = "a";
  if (fs.existsSync(dataPath)) {
    const existingFolders = fs
      .readdirSync(dataPath)
      .filter((f) => /^[a-z]$/.test(f));
    folder = String.fromCharCode(
      "a".charCodeAt(0) + (existingFolders.length % 26),
    );
  }
  return folder;
}

/**
 * Helper function to count data subfolders
 */
export function getDataSubFolderCount() {
  const preBasePath = process.cwd();
  return fs.readdirSync(`${preBasePath}/.data`).length;
}
export function getLatestVersion(): string {
  if (VersionList.length === 0) {
    // Fallback to a known good version if VersionList is somehow empty
    return "3.0.1";
  }
  // Return the latest version (last in array)
  return "3.0.1";
}

export function getNodeSdkVersion(sdkVersion: string): string {
  try {
    const versionConfig = getVersionConfig(sdkVersion);
    return versionConfig.nodeVersion;
  } catch {
    return "unknown";
  }
}

export function getLibxmtpVersion(sdkVersion: string): string {
  try {
    const versionConfig = getVersionConfig(sdkVersion);
    return versionConfig.libXmtpVersion;
  } catch {
    return "unknown";
  }
}
