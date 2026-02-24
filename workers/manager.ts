import fs from "fs";
import { appendFile } from "fs/promises";
import "dotenv/config";
import path from "path";
import { formatBytes, generateEncryptionKeyHex, sleep } from "@helpers/client";
import { resolveEnvironment, type ExtendedXmtpEnv } from "@helpers/environment";
import { ProgressBar } from "@helpers/logger";
import {
  getDefaultSdkVersion,
  isValidSdkVersion,
  VersionList,
  type Client,
  type Group,
  type XmtpEnv,
} from "@helpers/versions";
import { forkDetectedString } from "forks/constants";
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

  getAll(): Worker[];
  get(baseName: string | number, installationId?: string): Worker | undefined;
  mustGet(baseName: string | number, installationId?: string): Worker;
  getRandomWorkers(count: number): Worker[];
  getRandomWorker(): Worker | undefined;
  mustGetRandomWorker(): Worker;
  getCreator(): Worker | undefined;
  mustGetCreator(): Worker;
  getReceiver(): Worker | undefined;
  mustGetReceiver(): Worker;
  getAllButCreator(): Worker[];

  // Worker Creation & Management
  addWorker(baseName: string, installationId: string, worker: Worker): void;
  createWorker(descriptor: string, apiUrl?: string): Promise<Worker>;

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
  private extendedEnv: ExtendedXmtpEnv;
  private resolvedEnv: { sdkEnv: XmtpEnv; gatewayHost?: string };
  private keysCache: Record<
    string,
    { walletKey: string; encryptionKey: string }
  > = {};

  /**
   * Constructor creates an empty manager or populates it with existing workers
   */
  constructor(env: ExtendedXmtpEnv) {
    this.extendedEnv = env;
    this.resolvedEnv = resolveEnvironment(env);
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
   * Gets a random subset of workers
   */
  public getRandomWorkers(count: number): Worker[] {
    const allWorkers = this.getAll();
    return allWorkers.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  public getRandomWorker(): Worker | undefined {
    const allWorkers = this.getAll();
    return allWorkers[Math.floor(Math.random() * allWorkers.length)];
  }

  public mustGetRandomWorker(): Worker {
    const worker = this.getRandomWorker();
    if (!worker) {
      throw new Error("No workers available");
    }
    return worker;
  }

  public async checkForks(): Promise<void> {
    for (const worker of this.getAll()) {
      const groups = await worker.client.conversations.list();
      await Promise.all(
        groups.flat().map(async (g: any) => {
          const debugInfo = await (g as Group).debugInfo();
          if (debugInfo.maybeForked || debugInfo.isCommitLogForked) {
            throw new Error(
              `${forkDetectedString} Stopping test, group id ${g.id} may have forked`,
            );
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

      if (debugInfo.maybeForked || debugInfo.isCommitLogForked) {
        const logMessage = `${forkDetectedString}. Group id ${groupId} may have forked, epoch ${debugInfo.epoch} for worker ${worker.name}`;
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
            `${this.extendedEnv}:${baseName}-${installationId} ${currentWorker.address} ${currentWorker.sdk} ${installationCount.installations.length} - ${formatBytes(
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
  getCreator(): Worker | undefined {
    const workers = this.getAll();
    return workers[0];
  }

  getReceiver(): Worker | undefined {
    const workers = this.getAll();
    const creator = this.getCreator();
    const otherWorkers = workers.filter((worker) => worker !== creator);
    return otherWorkers[Math.floor(Math.random() * otherWorkers.length)];
  }
  async createGroupBetweenAll(
    groupName: string = `Test Group ${Math.random().toString(36).substring(2, 15)}`,
    extraMembers: string[] = [],
  ): Promise<Group> {
    const creator = this.mustGetCreator();
    const memberList = this.getAllButCreator().map(
      (worker) => worker.client.inboxId,
    );
    const group = await creator.worker.createGroup(memberList, {
      groupName,
    });
    if (extraMembers.length > 0) {
      await group.addMembers(extraMembers);
    }

    return group as Group;
  }

  getAllButCreator(): Worker[] {
    const workers = this.getAll();
    const creator = this.getCreator();
    if (!creator) {
      return workers;
    }
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
    installationId?: string,
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
      if (installationId) {
        return this.workers[baseName]?.[installationId];
      }
      // No installationId specified - return the first available installation
      const installations = this.workers[baseName];
      if (!installations) return undefined;
      const firstKey = Object.keys(installations)[0];
      return firstKey ? installations[firstKey] : undefined;
    }
  }

  /**
   * Gets a specific worker by name, throwing if not found
   */
  public mustGet(baseName: string | number, installationId?: string): Worker {
    const worker = this.get(baseName, installationId);
    if (!worker) {
      throw new Error(`Worker "${baseName}" not found`);
    }
    return worker;
  }

  /**
   * Gets the creator (first worker), throwing if no workers exist
   */
  public mustGetCreator(): Worker {
    const worker = this.getCreator();
    if (!worker) {
      throw new Error("No workers available");
    }
    return worker;
  }

  /**
   * Gets a receiver (random non-creator), throwing if insufficient workers
   */
  public mustGetReceiver(): Worker {
    const worker = this.getReceiver();
    if (!worker) {
      throw new Error("No receiver available");
    }
    return worker;
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
  private async ensureKeys(name: string): Promise<{
    walletKey: string;
    encryptionKey: string;
  }> {
    // Extract the base name without installation ID for key lookup
    const baseName = name.split("-")[0];

    if (baseName in this.keysCache) {
      //They persist in memory in the same test run
      console.debug(`Using cached keys for ${baseName}`);
      return this.keysCache[baseName];
    }

    const walletKeyEnv = `XMTP_WALLET_KEY_${baseName.toUpperCase()}`;
    const encryptionKeyEnv = `XMTP_DB_ENCRYPTION_KEY_${baseName.toUpperCase()}`;

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
      await appendFile(
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
    nodeBindings?: string,
    apiUrl?: string,
  ): Promise<Worker> {
    const parts = descriptor.split("-");
    const baseName = parts[0];

    let providedInstallId: string | undefined;
    let defaultSdk = nodeBindings || getDefaultSdkVersion();

    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      // Check if last part is a valid SDK version
      if (lastPart && isValidSdkVersion(lastPart)) {
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

    // Get or generate keys
    const { walletKey, encryptionKey } = await this.ensureKeys(baseName);

    // Determine folder/installation ID
    const folder = providedInstallId || getNextFolderName();

    // Create the base worker data
    const workerData: WorkerBase = {
      name: baseName,
      sdk: defaultSdk,
      folder,
      walletKey,
      encryptionKey,
    };

    // Use provided apiUrl, or fallback to XMTP_API_URL environment variable
    const effectiveApiUrl = apiUrl || process.env.XMTP_API_URL;

    // Create and initialize the worker
    const workerClient = new WorkerClient(
      workerData,
      this.resolvedEnv.sdkEnv,
      {},
      effectiveApiUrl,
      undefined,
      this.resolvedEnv.gatewayHost,
    );

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
      env: this.resolvedEnv.sdkEnv,
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
    env?: ExtendedXmtpEnv;
    nodeBindings?: string;
    randomNames?: boolean;
  } = {
    env: undefined,
    randomNames: true,
    nodeBindings: undefined,
  },
): Promise<WorkerManager> {
  const manager = new WorkerManager(
    (options.env as ExtendedXmtpEnv) ||
      (process.env.XMTP_ENV as ExtendedXmtpEnv),
  );
  let sdkVersions = [options.nodeBindings || getDefaultSdkVersion()];
  if (process.env.TEST_VERSIONS) {
    sdkVersions = VersionList.slice(0, parseInt(process.env.TEST_VERSIONS)).map(
      (v) => v.nodeBindings,
    );
  }
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
    descriptors = names;
    workerPromises = descriptors.map((descriptor) =>
      manager.createWorker(
        descriptor,
        sdkVersions[Math.floor(Math.random() * sdkVersions.length)],
      ),
    );
  } else {
    // Record input - apply versioning if requested
    let entries = Object.entries(workers);

    descriptors = entries.map(([descriptor]) => descriptor);
    workerPromises = entries.map(([descriptor, apiUrl]) =>
      manager.createWorker(descriptor, sdkVersions[0], apiUrl),
    );
  }

  // Only use progress bar if there are more than 50 workers
  const useProgressBar = workerPromises.length > 50;
  let progressBar: ProgressBar | undefined;

  if (useProgressBar) {
    progressBar = new ProgressBar(
      workerPromises.length,
      `Initializing ${workerPromises.length} workers...`,
    );
    // Show initial progress immediately
    progressBar.update(0);
  }

  // Track all workers in parallel and update progress as each completes
  let completedCount = 0;
  const results = await Promise.allSettled(
    workerPromises.map(async (workerPromise) => {
      try {
        const worker = await workerPromise;
        completedCount++;
        if (useProgressBar && progressBar) {
          progressBar.update(completedCount);
        }
        return worker;
      } catch (error) {
        completedCount++;
        if (useProgressBar && progressBar) {
          progressBar.update(completedCount);
        }
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
 * Uses atomic directory creation to avoid race conditions
 */
function getNextFolderName(): string {
  const dataPath = path.resolve(process.cwd(), ".data");

  // Ensure .data directory exists
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }

  const maxAttempts = 1000;

  for (let count = 0; count < maxAttempts; count++) {
    // Generate folder names: a-z, then aa-az, ba-bz, etc.
    let folderName: string;
    if (count < 26) {
      folderName = String.fromCharCode("a".charCodeAt(0) + count);
    } else {
      const firstIndex = Math.floor(count / 26) - 1;
      if (firstIndex >= 26) {
        throw new Error(
          "Folder limit exceeded: cannot create more than 702 folders"
        );
      }
      const first = String.fromCharCode("a".charCodeAt(0) + firstIndex);
      const second = String.fromCharCode("a".charCodeAt(0) + (count % 26));
      folderName = first + second;
    }

    const folderPath = path.join(dataPath, folderName);

    try {
      // Attempt atomic directory creation
      fs.mkdirSync(folderPath, { recursive: false });
      return folderName;
    } catch (error) {
      // If folder already exists, try next name
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        continue;
      }
      // Re-throw unexpected errors
      throw error;
    }
  }

  throw new Error(`Failed to create folder after ${maxAttempts} attempts`);
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
