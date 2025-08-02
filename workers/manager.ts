import fs from "fs";
import { appendFile } from "fs/promises";
import "dotenv/config";
import path from "path";
import { formatBytes, generateEncryptionKeyHex, sleep } from "@helpers/client";
import { ProgressBar } from "@helpers/logger";
import {
  getVersions,
  VersionList,
  type Client,
  type Group,
  type XmtpEnv,
} from "@workers/versions";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  installationThreshold,
  typeOfSync,
  WorkerClient,
  type typeofStream,
} from "./main";

/**
 * Interface documenting all methods available in WorkerManager class
 * This provides a quick reference for all available functionality
 */
interface IWorkerManager {
  // Lifecycle Management
  terminateAll(deleteDbs?: boolean): Promise<void>;

  // Worker Access & Retrieval
  getLength(): number;
  getAll(): Worker[];
  get(baseName: string | number, installationId?: string): Worker | undefined;
  getRandomWorkers(count: number): Worker[];
  getRandomWorker(): Worker;
  getCreator(): Worker;
  getReceiver(): Worker;
  getAllBut(excludeName: string): Worker[];
  getAllButCreator(): Worker[];

  // Worker Creation & Management
  addWorker(baseName: string, installationId: string, worker: Worker): void;
  createWorker(descriptor: string, apiUrl?: string): Promise<Worker>;

  // Monitoring & Statistics
  checkStatistics(): Promise<void>;
  checkForks(): Promise<void>;
  checkForksForGroup(groupId: string): Promise<bigint>;
  printWorkers(): Promise<void>;

  // Installation Management
  revokeExcessInstallations(threshold?: number): Promise<void>;

  // CLI & Configuration
  checkCLI(): void;

  // Streaming
  startStream(streamType: typeofStream): void;

  // Group Operations
  createGroupBetweenAll(
    groupName?: string,
    extraMembers?: string[],
  ): Promise<Group>;
}

// Deprecated: Use getWorkers with count and options instead
export const getFixedNames = (count: number): string[] => {
  return [...defaultNames].slice(0, count);
};

// Deprecated: Use getWorkers with count and options instead
export const getRandomNames = (count: number): string[] => {
  return [...defaultNames].sort(() => Math.random() - 0.5).slice(0, count);
};

// Deprecated: Use getWorkers with useVersions option instead
export function nameWithVersions(workerNames: string[]): string[] {
  const testVersions = parseInt(process.env.TEST_VERSIONS ?? "1");

  if (!testVersions) {
    // No versions specified, return names as-is (will use latest version)
    return workerNames;
  }

  const availableVersions = getVersions().slice(0, testVersions);
  const descriptors: string[] = [];
  for (const workerName of workerNames) {
    // Pick a random version from the specified list
    const randomVersion =
      availableVersions[Math.floor(Math.random() * availableVersions.length)];

    // If workerName already contains installation ID (has dash), don't add another "-a"
    if (workerName.includes("-")) {
      descriptors.push(`${workerName}-${randomVersion.nodeSDK}`);
    } else {
      descriptors.push(`${workerName}-a-${randomVersion.nodeSDK}`);
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
  initializationTime: number;
}

/**
 * WorkerManager: A unified class for managing workers and their lifecycle
 * Combines the functionality of both WorkerManager and WorkerFactory
 */
export class WorkerManager implements IWorkerManager {
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

  public async checkStatistics(): Promise<void> {
    for (const worker of this.getAll()) {
      await worker.worker.getStats();
    }
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

  public checkCLI() {
    // Apply sync strategy if specified in environment
    const syncStrategyString = process.env.SYNC_STRATEGY;
    if (syncStrategyString) {
      for (const worker of this.getAll()) {
        let syncType: typeOfSync = typeOfSync.None;
        if (syncStrategyString === "all") {
          syncType = typeOfSync.SyncAll;
        } else if (syncStrategyString === "sync") {
          syncType = typeOfSync.Sync;
        } else if (syncStrategyString === "both") {
          syncType = typeOfSync.Both;
        }
        worker.worker.startSync(syncType);
      }
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
            `${this.env}:${baseName}-${installationId} ${currentWorker.address} ${currentWorker.sdk} ${installationCount.installations.length} - ${formatBytes(
              (await currentWorker.worker.getSQLiteFileSizes())?.total,
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
    extraMembers: string[] = [],
  ): Promise<Group> {
    const creator = this.getCreator();
    const memberList = this.getAllButCreator().map(
      (worker) => worker.client.inboxId,
    );
    const group = await creator.client.conversations.newGroup(memberList, {
      groupName,
    });
    if (extraMembers.length > 0) {
      await group.addMembers(extraMembers);
    }

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
    baseName: string | number,
    installationId: string = "a",
  ): Worker | undefined {
    if (typeof baseName === "number") {
      let index = baseName;
      if (index >= this.getAll().length) {
        throw new Error(`Worker index ${index} out of bounds`);
      }
      return this.getAll()[index];
    } else {
      if (baseName.includes("-")) {
        const parts = baseName.split("-");
        const name = parts[0];
        const id = parts[1];
        return this.workers[name]?.[id];
      }
      return this.workers[baseName]?.[installationId];
    }
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
    //console.debug(`Generating new keys for ${baseName}`);
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

    let providedInstallId: string | undefined;
    let defaultSdk = getVersions()[0].nodeSDK;

    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      // Check if last part is a valid SDK version
      if (lastPart && VersionList.some((v) => v.nodeSDK === lastPart)) {
        defaultSdk = lastPart;
        // Installation ID is everything between baseName and version
        if (parts.length > 2) {
          providedInstallId = parts.slice(1, -1).join("-");
        }
      } else {
        // No version specified, everything after baseName is installation ID
        providedInstallId = parts.slice(1).join("-");
      }
    }

    // Check if the worker already exists in our production storage
    if (providedInstallId && this.workers[baseName]?.[providedInstallId]) {
      console.debug(`Reusing existing worker for ${descriptor}`);
      return this.workers[baseName][providedInstallId];
    }

    // Determine folder/installation ID
    const folder = providedInstallId || getNextFolderName();

    // Get or generate keys
    const { walletKey, encryptionKey } = this.ensureKeys(baseName);

    // Create the base worker data
    const workerData: WorkerBase = {
      name: baseName,
      sdk: defaultSdk,
      folder,
      walletKey,
      encryptionKey,
    };

    // Create and initialize the worker
    const workerClient = new WorkerClient(workerData, this.env, {}, apiUrl);

    const startTime = performance.now();
    const initializedWorker = await workerClient.initialize();
    const endTime = performance.now();
    const initializationTime = endTime - startTime;

    // Create the complete worker
    const worker: Worker = {
      ...workerData,
      client: initializedWorker.client,
      inboxId: initializedWorker.client.inboxId,
      dbPath: initializedWorker.dbPath,
      address: initializedWorker.address,
      installationId: initializedWorker.client.installationId,
      env: this.env,
      folder,
      worker: workerClient,
      initializationTime,
    };

    // Store the new worker for potential cleanup later
    this.activeWorkers.push(workerClient);

    // Add to our production storage
    this.addWorker(baseName, folder, worker);

    return worker;
  }
}

/**
 * Factory function to create a WorkerManager with initialized workers
 */
export async function getWorkers(
  workers: string[] | Record<string, string> | number,
  options: {
    env?: XmtpEnv;
    nodeSDK?: string;
    useVersions?: boolean;
    randomNames?: boolean;
  } = {
    env: undefined,
    useVersions: true,
    randomNames: true,
    nodeSDK: undefined,
  },
): Promise<WorkerManager> {
  const manager = new WorkerManager(
    (options.env as XmtpEnv) || (process.env.XMTP_ENV as XmtpEnv),
  );

  let workerPromises: Promise<Worker>[] = [];
  let descriptors: string[] = [];

  // Handle different input types
  if (typeof workers === "number" || Array.isArray(workers)) {
    const names =
      typeof workers === "number"
        ? options.randomNames
          ? getRandomNames(workers)
          : getFixedNames(workers)
        : workers;
    descriptors = options.nodeSDK
      ? names.map((name) => `${name}-${options.nodeSDK}`)
      : options.useVersions
        ? nameWithVersions(names)
        : names;
    console.log(`Preparing to create ${descriptors.length} workers...`);
    workerPromises = descriptors.map((descriptor) =>
      manager.createWorker(descriptor),
    );
  } else {
    // Record input - apply versioning if requested
    let entries = Object.entries(workers);

    if (options.useVersions) {
      const versionedKeys = Object.keys(workers);
      entries = versionedKeys.map((key, index) => [
        key,
        Object.values(workers)[index],
      ]);
    }

    descriptors = entries.map(([descriptor]) => descriptor);
    console.log(`Preparing to create ${descriptors.length} workers...`);
    workerPromises = entries.map(([descriptor, apiUrl]) =>
      manager.createWorker(descriptor, apiUrl),
    );
  }

  // Initialize progress bar
  const progressBar = new ProgressBar(
    workerPromises.length,
    `Initializing ${workerPromises.length} workers...`,
  );

  // Show initial progress immediately
  progressBar.update(0);

  // Track all workers in parallel and update progress as each completes
  let completedCount = 0;
  const results = await Promise.allSettled(
    workerPromises.map(async (workerPromise) => {
      try {
        const worker = await workerPromise;
        completedCount++;
        progressBar.update(completedCount);
        return worker;
      } catch (error) {
        completedCount++;
        progressBar.update(completedCount);
        throw error;
      }
    }),
  );

  // Check for any failures
  const failedResults = results.filter(
    (result) => result.status === "rejected",
  );
  if (failedResults.length > 0) {
    throw failedResults[0].reason;
  }

  // Extract successful results
  const successfulResults = results.map(
    (result) => (result as PromiseFulfilledResult<Worker>).value,
  );

  console.log("✅ All workers initialized successfully!");

  // Add all successful workers to the manager
  for (const worker of successfulResults) {
    manager.addWorker(worker.name, worker.folder, worker);
  }

  manager.checkCLI();
  await manager.printWorkers();
  await manager.revokeExcessInstallations();

  return manager;
}

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

// 100 unique names
export const defaultNames = [
  "alice",
  "bob",
  "charlie",
  "diana",
  "edward",
  "fiona",
  "george",
  "hannah",
  "ian",
  "julia",
  "kevin",
  "luna",
  "marcus",
  "nina",
  "owen",
  "petra",
  "quincy",
  "ruby",
  "simon",
  "tessa",
  "ulrich",
  "vera",
  "winston",
  "xara",
  "yuki",
  "zoe",
  "adrian",
  "bianca",
  "carlos",
  "delphine",
  "ethan",
  "freya",
  "gabriel",
  "hazel",
  "iris",
  "jasper",
  "kira",
  "liam",
  "maya",
  "noah",
  "olive",
  "phoenix",
  "quinn",
  "river",
  "sage",
  "theo",
  "uma",
  "violet",
  "willow",
  "xander",
  "yasmin",
  "zane",
  "aria",
  "blake",
  "cleo",
  "dante",
  "ember",
  "felix",
  "gemma",
  "hugo",
  "indigo",
  "jade",
  "kai",
  "leo",
  "mira",
  "nora",
  "orion",
  "piper",
  "quest",
  "raven",
  "stella",
  "tyler",
  "unity",
  "vance",
  "wren",
  "xavi",
  "yara",
  "zara",
  "atlas",
  "brooke",
  "cruz",
  "dove",
  "elena",
  "finn",
  "grace",
  "hunter",
  "ivy",
  "jude",
  "knox",
  "lyra",
  "milo",
  "neve",
  "oslo",
  "penny",
  "quill",
  "rose",
  "sky",
  "terra",
  "ula",
  "vega",
  "wave",
  "xyla",
  "york",
  "zion",
];
