import fs from "fs";
import { appendFile } from "fs/promises";
import path from "path";
import { generateEncryptionKeyHex } from "@helpers/client";
import { defaultValues, sdkVersionOptions, sdkVersions } from "@helpers/tests";
import { type Client, type XmtpEnv } from "@xmtp/node-sdk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { WorkerClient } from "./main";

export type typeofStream = "message" | "conversation" | "consent" | "none";

export interface WorkerBase {
  name: string;
  folder: string;
  walletKey: string;
  encryptionKey: string;
  testName: string;
  sdkVersion: string;
  libXmtpVersion: string;
}

export interface Worker extends WorkerBase {
  worker: WorkerClient;
  dbPath: string;
  client: Client;
  sdkVersion: string;
  libXmtpVersion: string;
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
  private testName: string;
  private activeWorkers: WorkerClient[] = [];
  private typeofStream: typeofStream = "message";
  private gptEnabled: boolean = false;
  private env: XmtpEnv;
  private keysCache: Record<
    string,
    { walletKey: string; encryptionKey: string }
  > = {};

  /**
   * Constructor creates an empty manager or populates it with existing workers
   */
  constructor(
    testName: string,
    typeofStream: typeofStream = "message",
    gptEnabled: boolean = false,
    env: XmtpEnv,
    existingWorkers?: Record<string, Record<string, Worker>>,
  ) {
    this.testName = testName;
    this.typeofStream = typeofStream;
    this.gptEnabled = gptEnabled;
    this.env = env;
    this.workers = existingWorkers || {};
  }
  /**
   * Terminates all active workers and cleans up resources
   */
  public async terminateAll(deleteDbs: boolean = false): Promise<void> {
    const terminationPromises = this.activeWorkers.map(async (worker) => {
      try {
        await worker.terminate();
        if (deleteDbs) {
          await worker.clearDB();
        }
      } catch (error) {
        console.warn(`Error terminating worker:`, error);
      }
    });

    await Promise.all(terminationPromises);
    this.activeWorkers = [];

    // Clear the workers object
    this.workers = {};
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
    const allWorkers = this.getWorkers();
    return allWorkers.sort(() => 0.5 - Math.random()).slice(0, count);
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

  /**
   * Gets all workers as a flat array
   */
  public getWorkers(): Worker[] {
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
      console.log(`Using cached keys for ${baseName}`);
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
    console.log(`Generating new keys for ${baseName}`);
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
  public async createWorker(descriptor: string): Promise<Worker> {
    // Parse the descriptor into components: name, folder, and version
    const parts = descriptor.split("-");
    const baseName = parts[0];
    const providedInstallId = parts.length > 1 ? parts[1] : undefined;
    // Check if the worker already exists in our internal storage
    if (providedInstallId && this.workers[baseName]?.[providedInstallId]) {
      console.log(`Reusing existing worker for ${descriptor}`);
      return this.workers[baseName][providedInstallId];
    }

    // Determine folder/installation ID
    const folder = providedInstallId || getNextFolderName();

    const sdkVersion = parts.length > 2 ? parts[2] : getLatestVersion();
    const libXmtpVersion = getLibxmtpVersion(sdkVersion);

    // Get or generate keys
    const { walletKey, encryptionKey } = this.ensureKeys(baseName);

    // Create the base worker data
    const workerData: WorkerBase = {
      name: baseName,
      folder,
      testName: this.testName,
      walletKey,
      encryptionKey,
      sdkVersion: sdkVersion,
      libXmtpVersion: libXmtpVersion,
    };

    // Create and initialize the worker
    const workerClient = new WorkerClient(
      workerData,
      this.typeofStream,
      this.gptEnabled,
      this.env,
    );

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

  /**
   * Creates multiple workers at once from descriptors
   */
  public async createWorkers(
    descriptorsOrAmount: string[] | number,
  ): Promise<Worker[]> {
    let descriptors: string[];

    // Handle numeric input (create N default workers)
    if (typeof descriptorsOrAmount === "number") {
      const workerNames = defaultValues.defaultNames;
      descriptors = workerNames.slice(0, descriptorsOrAmount);
      // If we need to create multiple workers with random SDK versions
      // Generate workers with random SDK versions (100, 105, or 202)

      // Create descriptors with random SDK versions
      descriptors = [];
      for (let i = 0; i < descriptorsOrAmount; i++) {
        const workerName =
          defaultValues.defaultNames[i % defaultValues.defaultNames.length];
        const randomSdkVersion =
          sdkVersionOptions[
            Math.floor(Math.random() * sdkVersionOptions.length)
          ];
        //fix
        descriptors.push(`${workerName}-a`);
      }
    } else {
      descriptors = descriptorsOrAmount;
    }
    console.log("Creating workers", descriptors);

    // Process descriptors in parallel
    const workerPromises = descriptors.map((descriptor) =>
      this.createWorker(descriptor),
    );
    return Promise.all(workerPromises);
  }
}

/**
 * Factory function to create a WorkerManager with initialized workers
 */
export async function getWorkers(
  descriptorsOrAmount: string[] | number,
  testName: string,
  typeofStream: typeofStream = "message",
  gptEnabled: boolean = false,
  existingWorkers?: WorkerManager,
  env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv,
): Promise<WorkerManager> {
  const manager =
    existingWorkers ||
    new WorkerManager(testName, typeofStream, gptEnabled, env, undefined);
  await manager.createWorkers(descriptorsOrAmount);
  return manager;
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
  return Object.keys(sdkVersions).pop() as string;
}

export function getLibxmtpVersion(sdkVersion: string): string {
  return sdkVersions[Number(sdkVersion) as keyof typeof sdkVersions]
    .libXmtpVersion;
}
