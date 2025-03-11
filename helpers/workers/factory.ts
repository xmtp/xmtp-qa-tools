import fs from "fs";
import { appendFile } from "fs/promises";
import path from "path";
import { generateEncryptionKeyHex } from "@helpers/client";
import {
  defaultValues,
  NestedPersonas,
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
      const account = privateKeyToAccount(
        process.env[walletKeyEnv] as `0x${string}`,
      );
      console.log(`Using env keys for ${baseName}: ${account.address}`);

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

  public async createPersona(descriptor: string): Promise<Persona> {
    // Check if the persona already exists in the global cache
    if (globalWorkerCache[descriptor] && globalWorkerCache[descriptor].client) {
      console.log(`Reusing cached worker for ${descriptor}`);
      return globalWorkerCache[descriptor];
    }

    // Split the descriptor to get the base name and installation ID
    const [baseName, installationId] = descriptor.split("-");
    const folder = installationId || getNextFolderName();

    console.debug(descriptor, baseName, installationId, folder);
    const { walletKey, encryptionKey } = this.ensureKeys(descriptor);

    const personaData: PersonaBase = {
      name: descriptor,
      folder,
      testName: this.testName,
      walletKey,
      encryptionKey,
    };

    const workerClient = new WorkerClient(
      personaData,
      this.typeofStream,
      this.gptEnabled,
    );
    const worker = await workerClient.initialize();

    const persona: Persona = {
      ...personaData,
      client: worker.client,
      dbPath: worker.dbPath,
      version: worker.version,
      address: worker.client.accountAddress,
      installationId: worker.installationId,
      worker: workerClient,
    };

    // Add to global cache for future reuse
    globalWorkerCache[persona.name] = persona;

    // Store the new worker for potential cleanup later
    this.activeWorkers.push(workerClient);

    return persona;
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
  gptEnabled: boolean = false,
  existingPersonas?: NestedPersonas,
): Promise<NestedPersonas> {
  let descriptors: string[];
  if (typeof descriptorsOrAmount === "number") {
    const workerNames = defaultValues.defaultNames;
    const orderedNames = workerNames.slice(0, descriptorsOrAmount);
    descriptors = orderedNames;
  } else {
    descriptors = descriptorsOrAmount;
  }

  const personaFactory = new PersonaFactory(testName, typeofStream, gptEnabled);

  // Process descriptors in parallel
  const personaPromises = descriptors.map((descriptor) => {
    const [baseName, installationId] = descriptor.split("-");
    const finalDescriptor = installationId
      ? descriptor
      : `${baseName}-${getNextFolderName()}`;

    console.debug(finalDescriptor);
    return personaFactory.createPersona(finalDescriptor);
  });

  const personasArray = await Promise.all(personaPromises);

  // If existing personas are provided, add new workers to it
  if (existingPersonas) {
    personasArray.forEach((persona) => {
      const [baseName, installationId] = persona.name.split("-");
      existingPersonas.addWorker(baseName, installationId || "a", persona);
    });
    return existingPersonas;
  }

  // Convert the array of personas to a nested record
  const personas = personasArray.reduce<
    Record<string, Record<string, Persona>>
  >((acc, persona) => {
    const [baseName, installationId] = persona.name.split("-");

    if (!acc[baseName]) {
      acc[baseName] = {};
    }

    acc[baseName][installationId || "a"] = persona;
    return acc;
  }, {});

  return new NestedPersonas(personas);
}

// Helper function to get the next available folder name
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
