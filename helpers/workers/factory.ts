import fs from "fs";
import { appendFile } from "fs/promises";
import path from "path";
import { generateEncryptionKeyHex } from "@helpers/client";
import {
  defaultValues,
  type Client,
  type Persona,
  type PersonaBase,
  type typeofStream,
} from "@helpers/types";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { WorkerClient } from "./main";

// Adding createInstallation to the WorkerClient interface
declare module "./main" {
  interface WorkerClient {
    createInstallation(newInstallationId: string): Promise<Persona>;
  }
}

// Global cache to store workers across multiple getWorkers calls
// Using a more complex key that includes installation ID
const globalWorkerCache: Record<string, Persona> = {};

/**
 * The PersonaFactory is responsible for creating Persona objects
 * and ensuring they each have a WorkerClient + XMTP Client.
 */
export class PersonaFactory {
  private testName: string;
  private activeWorkers: WorkerClient[] = []; // Add this to track workers
  private gptEnabled: boolean;
  private typeofStream: typeofStream;

  constructor(
    testName: string,
    typeofStream: typeofStream,
    gptEnabled: boolean,
  ) {
    this.testName = testName;
    this.typeofStream = typeofStream;
    this.gptEnabled = gptEnabled;
  }

  /**
   * Ensure a particular persona (by name and installation) has appropriate keys.
   * Keys are specific to base name + installation ID combinations.
   */
  private keysCache: Record<
    string,
    { walletKey: string; encryptionKey: string }
  > = {};

  private ensureKeys(
    baseName: string,
    installationId: string,
  ): {
    walletKey: string;
    encryptionKey: string;
  } {
    // Create a unique key combining name and installation
    const cacheKey = `${baseName}-${installationId}`;

    if (cacheKey in this.keysCache) {
      console.log(`[PersonaFactory] Using cached keys for ${cacheKey}`);
      return this.keysCache[cacheKey];
    }

    // Check if we have specific keys for this installation
    const installationSpecificKeyEnv = `WALLET_KEY_${baseName.toUpperCase()}_${installationId.toUpperCase()}`;
    const installationSpecificEncKeyEnv = `ENCRYPTION_KEY_${baseName.toUpperCase()}_${installationId.toUpperCase()}`;

    // Also check for base keys (backward compatibility)
    const baseWalletKeyEnv = `WALLET_KEY_${baseName.toUpperCase()}`;
    const baseEncryptionKeyEnv = `ENCRYPTION_KEY_${baseName.toUpperCase()}`;

    // First, try installation-specific keys
    if (
      process.env[installationSpecificKeyEnv] !== undefined &&
      process.env[installationSpecificEncKeyEnv] !== undefined
    ) {
      const account = privateKeyToAccount(
        process.env[installationSpecificKeyEnv] as `0x${string}`,
      );
      console.log(
        `[PersonaFactory] Using installation-specific keys for ${cacheKey}: ${account.address}`,
      );

      this.keysCache[cacheKey] = {
        walletKey: process.env[installationSpecificKeyEnv],
        encryptionKey: process.env[installationSpecificEncKeyEnv],
      };

      return this.keysCache[cacheKey];
    }

    // Next, try base keys if no installation-specific keys exist
    if (
      process.env[baseWalletKeyEnv] !== undefined &&
      process.env[baseEncryptionKeyEnv] !== undefined
    ) {
      // For different installations of the same base name,
      // we'll use the same wallet key but different encryption keys
      // This allows for multiple installations with same identity
      const walletKey = process.env[baseWalletKeyEnv];

      // For different installations, we need different encryption keys
      // If we're using installation "a", use the base encryption key
      // Otherwise, generate a new one for this installation
      let encryptionKey;
      if (installationId.toLowerCase() === "a") {
        encryptionKey = process.env[baseEncryptionKeyEnv];
      } else {
        // For other installations, generate a new encryption key
        // This ensures different DB paths and installations
        encryptionKey = generateEncryptionKeyHex();
      }

      const account = privateKeyToAccount(walletKey as `0x${string}`);

      console.log(
        `[PersonaFactory] Using base wallet key with ${installationId === "a" ? "base" : "new"} encryption key for ${cacheKey}: ${account.address}`,
      );

      this.keysCache[cacheKey] = {
        walletKey,
        encryptionKey,
      };

      // Store the new encryption key in env for persistence
      process.env[installationSpecificEncKeyEnv] = encryptionKey;

      // If this isn't a random persona, also append to .env file
      if (!baseName.includes("random")) {
        const filePath =
          process.env.CURRENT_ENV_PATH || path.resolve(process.cwd(), ".env");
        void appendFile(
          filePath,
          `\n${installationSpecificEncKeyEnv}=${encryptionKey}\n# Installation ${installationId} for ${baseName}\n`,
        );
      }

      return this.keysCache[cacheKey];
    }

    // If we get here, we need to generate completely new keys
    console.log(`[PersonaFactory] Generating new keys for ${cacheKey}`);
    const walletKey = generatePrivateKey();
    const account = privateKeyToAccount(walletKey);
    const encryptionKey = generateEncryptionKeyHex();
    const publicKey = account.address;

    // Store in cache
    this.keysCache[cacheKey] = {
      walletKey,
      encryptionKey,
    };

    // Update process.env directly
    process.env[installationSpecificKeyEnv] = walletKey;
    process.env[installationSpecificEncKeyEnv] = encryptionKey;

    // Also set base keys if this is installation "a"
    if (installationId.toLowerCase() === "a") {
      process.env[baseWalletKeyEnv] = walletKey;
      process.env[baseEncryptionKeyEnv] = encryptionKey;
    }

    if (!baseName.includes("random")) {
      // Append to .env file for persistence across runs
      const filePath =
        process.env.CURRENT_ENV_PATH || path.resolve(process.cwd(), ".env");
      void appendFile(
        filePath,
        `\n${installationSpecificKeyEnv}=${walletKey}\n${installationSpecificEncKeyEnv}=${encryptionKey}\n# Installation ${installationId} for ${baseName}, public key is ${publicKey}\n`,
      );

      // Also append base keys if this is installation "a"
      if (installationId.toLowerCase() === "a") {
        void appendFile(
          filePath,
          `\n${baseWalletKeyEnv}=${walletKey}\n${baseEncryptionKeyEnv}=${encryptionKey}\n# Base keys for ${baseName}\n`,
        );
      }
    }

    return this.keysCache[cacheKey];
  }

  /**
   * Parses a persona descriptor like "bob-a-12" into its components:
   * baseName, installationId, and sdkVersion.
   *
   * e.g. "bob-a-12" => { name: "bob", installationId: "a", sdkVersion: "12" }
   *
   * If any parts are missing, fall back to defaults.
   */
  public parsePersonaDescriptor(
    descriptor: string,
    defaults: {
      installationId: string;
      sdkVersion: string;
    } = {
      installationId: defaultValues.installationId,
      sdkVersion: defaultValues.sdkVersion,
    },
  ): {
    name: string;
    installationId: string;
    sdkVersion: string;
  } {
    const parts = descriptor.split("-");
    const baseName = parts[0];
    const installationId =
      parts.length > 1 ? parts[1] : defaults.installationId;
    const sdkVersion = parts.length > 2 ? parts[2] : defaults.sdkVersion;

    return {
      name: baseName,
      installationId,
      sdkVersion,
    };
  }

  public async flushWorkers(): Promise<void> {
    await Promise.all(this.activeWorkers.map((worker) => worker.terminate()));
    this.activeWorkers = [];
  }

  /**
   * Creates an array of Persona objects from the given descriptors.
   * Each persona either has pre-existing keys (if the descriptor is "alice", etc.)
   * or random keys (if descriptor includes "random").
   * Then spins up a WorkerClient for each persona, initializes it,
   * and returns the complete Persona array.
   */
  public async createPersonas(descriptors: string[]): Promise<Persona[]> {
    await this.flushWorkers();

    const personas: Persona[] = [];
    const newDescriptors: string[] = [];
    const newPersonas: Persona[] = [];

    // First, check which personas already exist in the global cache
    for (const desc of descriptors) {
      if (globalWorkerCache[desc] && globalWorkerCache[desc].client) {
        console.log(`[PersonaFactory] Reusing cached worker for ${desc}`);
        personas.push(globalWorkerCache[desc]);
        continue;
      } else {
        // Add all other descriptors to the list of new ones to create
        newDescriptors.push(desc);
      }
    }

    // Only create new personas for descriptors not in the cache
    if (newDescriptors.length > 0) {
      for (const desc of newDescriptors) {
        let personaData: PersonaBase;
        const { name, installationId, sdkVersion } =
          this.parsePersonaDescriptor(desc);

        if (desc.includes("random")) {
          // Generate ephemeral keys
          const { walletKey, encryptionKey } = this.ensureKeys(
            name,
            installationId,
          );

          personaData = {
            name: desc,
            testName: this.testName,
            installationId,
            sdkVersion,
            walletKey,
            encryptionKey,
          };
        } else {
          // Use or generate keys from environment
          const { walletKey, encryptionKey } = this.ensureKeys(
            name,
            installationId,
          );

          personaData = {
            name: desc, // Use full descriptor as name to preserve the full descriptor
            testName: this.testName,
            installationId,
            sdkVersion,
            walletKey,
            encryptionKey,
          };
        }

        newPersonas.push({
          ...personaData,
          worker: null,
          client: null,
          dbPath: "",
          address: "",
          version: "",
        });
      }

      // Spin up Workers in parallel only for new personas
      const messageWorkers = await Promise.all(
        newPersonas.map(
          (p) => new WorkerClient(p, this.typeofStream, this.gptEnabled),
        ),
      );

      // Initialize each worker's XMTP client in parallel
      const workers = await Promise.all([
        ...messageWorkers.map((w) => w.initialize()),
      ]);

      newPersonas.forEach((p, index) => {
        p.client = workers[index].client;
        p.dbPath = workers[index].dbPath;
        p.version = workers[index].version;
        p.worker = messageWorkers[index];

        // Add to global cache for future reuse
        globalWorkerCache[p.name] = p;
      });

      // Store the new workers for potential cleanup later
      this.activeWorkers = [...this.activeWorkers, ...messageWorkers];

      // Combine existing and new personas
      personas.push(...newPersonas);
    }

    return personas;
  }

  /**
   * This method is now moved directly to the WorkerClient class
   * See WorkerClient.createInstallation() below
   */
}

/**
 * Helper function to create a keyed record of Persona objects from descriptors.
 * This is useful if you want something like:
 *   { "alice-a": Persona, "bob-b": Persona }
 *
 * @param descriptors e.g. ["alice-a", "bob-b", "random1-a"]
 * @param testName    Not currently used, but can be used for labeling or logging
 */
export async function getWorkers(
  descriptorsOrAmount: string[] | number,
  testName: string,
  typeofStream: typeofStream = "message",
  gptEnabled: boolean = false,
): Promise<Record<string, Persona>> {
  let descriptors: string[];
  if (typeof descriptorsOrAmount === "number") {
    // When a number is provided, create default personas with installation "b"
    const workerNames = defaultValues.defaultNames;
    descriptors = workerNames
      .slice(0, descriptorsOrAmount)
      .map((name) => `${name}-b`); // Append default installation ID "b"
  } else {
    descriptors = descriptorsOrAmount;
  }

  const personaFactory = new PersonaFactory(testName, typeofStream, gptEnabled);

  const personas = await personaFactory.createPersonas(descriptors);

  return personas.reduce<Record<string, Persona>>((acc, p) => {
    // Use the full descriptor as the key in the returned object
    acc[p.name] = p;
    return acc;
  }, {});
}

// We'll remove this function and implement it directly in the WorkerClient

// Function to clear the global worker cache if needed
export async function clearWorkerCache(): Promise<void> {
  // First terminate all workers
  for (const key in globalWorkerCache) {
    try {
      // Check if the key exists and has a worker property before trying to terminate
      if (globalWorkerCache[key].worker) {
        await globalWorkerCache[key].worker.terminate();
      }
    } catch (error) {
      console.warn(`Error terminating worker for ${key}:`, error);
    }
  }

  // Create a new empty object with the same reference
  const keys = Object.keys(globalWorkerCache);
  keys.forEach((key) => {
    // @ts-expect-error: We're intentionally clearing the cache
    globalWorkerCache[key] = undefined;
  });
}

export function getDataSubFolderCount() {
  const preBasePath = process.cwd();
  return fs.readdirSync(`${preBasePath}/.data`).length;
}

export async function getInstallations(client: Client) {
  await client.conversations.syncAll();
  const conversations = await client.conversations.list();
  const uniqueInstallationIds = new Set<string>();

  for (const conversation of conversations) {
    await conversation.sync();
    const members = await conversation.members();
    for (const member of members) {
      if (member.inboxId === client.inboxId) {
        member.installationIds.forEach((id) => uniqueInstallationIds.add(id));
      }
    }
  }

  return uniqueInstallationIds;
}
