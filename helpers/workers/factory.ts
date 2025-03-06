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

// Global cache to store workers across multiple getWorkers calls
const globalWorkerCache: Record<string, Persona> = {};

/**
 * The PersonaFactory is responsible for creating Persona objects
 * and ensuring they each have a WorkerClient + XMTP Client.
 */
export class PersonaFactory {
  private testName: string;
  private activeWorkers: WorkerClient[] = []; // Add this to track workers

  private typeofStream: typeofStream;
  constructor(testName: string, typeofStream: typeofStream) {
    this.testName = testName;
    this.typeofStream = typeofStream;
  }

  /**
   * Ensure a particular persona (by name) has a wallet key and encryption key.
   * If these are not found in the environment variables, generate them via a yarn script.
   */
  // keep a cache of keys
  private keysCache: Record<
    string,
    { walletKey: string; encryptionKey: string }
  > = {};
  private ensureKeys(name: string): {
    walletKey: string;
    encryptionKey: string;
  } {
    // Extract the base name without installation ID for key lookup
    const baseName = name.split("-")[0];

    if (baseName in this.keysCache) {
      console.log(`[PersonaFactory] Using cached keys for ${baseName}`);
      return this.keysCache[baseName];
    }

    const walletKeyEnv = `WALLET_KEY_${baseName.toUpperCase()}`;
    const encryptionKeyEnv = `ENCRYPTION_KEY_${baseName.toUpperCase()}`;

    // Check if keys exist in environment variables
    if (
      process.env[walletKeyEnv] !== undefined &&
      process.env[encryptionKeyEnv] !== undefined
    ) {
      console.log(
        `[PersonaFactory] Using env keys for ${baseName}: ${process.env[walletKeyEnv].substring(0, 6)}...`,
      );

      this.keysCache[baseName] = {
        walletKey: process.env[walletKeyEnv],
        encryptionKey: process.env[encryptionKeyEnv],
      };

      return this.keysCache[baseName];
    }

    // Keys don't exist, generate new ones
    console.log(`[PersonaFactory] Generating new keys for ${baseName}`);
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
   * Parses a persona descriptor like "aliceA42" into its components:
   * baseName, installationId, sdkVersion, and libxmtpVersion.
   *
   * e.g. "bobB12" => { name: "bob", installationId: "B", sdkVersion: "12", libxmtpVersion: "12" }
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
    const baseName = descriptor.split("-")[0];
    const installationId = descriptor.split("-")[1];
    const sdkVersion = descriptor.split("-")[2];

    return {
      name: baseName,
      installationId: installationId || defaults.installationId,
      sdkVersion: sdkVersion || defaults.sdkVersion,
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
      if (
        desc in globalWorkerCache &&
        globalWorkerCache[desc] &&
        globalWorkerCache[desc].client
      ) {
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

        if (desc.includes("random")) {
          // Generate ephemeral keys
          const { name, installationId, sdkVersion } =
            this.parsePersonaDescriptor(desc);

          const { walletKey, encryptionKey } = this.ensureKeys(name);

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
          const { name, installationId, sdkVersion } =
            this.parsePersonaDescriptor(desc);

          const { walletKey, encryptionKey } = this.ensureKeys(name);

          personaData = {
            name: desc, // Use full descriptor as name to preserve installation ID
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
        newPersonas.map((p) => new WorkerClient(p, this.typeofStream)),
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
}

/**
 * Helper function to create a keyed record of Persona objects from descriptors.
 * This is useful if you want something like:
 *   { alice: Persona, bob: Persona }
 *
 * @param descriptors e.g. ["aliceA12", "bob", "random1"]
 * @param testName    Not currently used, but can be used for labeling or logging
 */
export async function getWorkers(
  descriptorsOrAmount: string[] | number,
  testName: string,
  typeofStream: typeofStream = "message",
): Promise<Record<string, Persona>> {
  let descriptors: string[];
  if (typeof descriptorsOrAmount === "number") {
    const workerNames = defaultValues.defaultNames;
    const orderedNames = workerNames.slice(0, descriptorsOrAmount);
    descriptors = orderedNames;
  } else {
    descriptors = descriptorsOrAmount;
  }

  const personaFactory = new PersonaFactory(testName, typeofStream);

  const personas = await personaFactory.createPersonas(descriptors);
  Object.values(personas).forEach((persona) => {
    console.log(persona.name, persona.client?.accountAddress);
  });
  return personas.reduce<Record<string, Persona>>((acc, p) => {
    // Use the full descriptor as the key in the returned object
    acc[p.name] = p;
    return acc;
  }, {});
}

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

  // Clear the cache by setting all entries to undefined
  for (const key in globalWorkerCache) {
    try {
      // @ts-expect-error: We're intentionally clearing the cache
      globalWorkerCache[key] = undefined;
    } catch (error) {
      console.warn(`Error clearing cache for ${key}:`, error);
    }
  }

  // Create a new empty object with the same reference
  // This is a workaround to avoid using delete on dynamically computed property keys
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
