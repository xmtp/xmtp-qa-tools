import fs from "fs";
import { appendFile } from "fs/promises";
import path from "path";
import { generateEncryptionKeyHex } from "@helpers/client";
import { type Client, type typeofStream } from "@helpers/types";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { WorkerClient } from "./main";
import {
  AgentManager,
  defaultNames,
  type Agent,
  type AgentBase,
} from "./manager";

// Global cache to store agents across multiple createAgent calls
const globalWorkerCache: Record<string, Agent> = {};

/**
 * The PersonaFactory is responsible for creating Persona objects
 * and ensuring they each have a WorkerClient + XMTP Client.
 */
export class PersonaFactory {
  private testName: string;
  private activeAgents: Agent[] = []; // Add this to track agents
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

  public async createAgent(descriptor: string): Promise<Agent> {
    // Check if the persona already exists in the global cache
    if (globalWorkerCache[descriptor] && globalWorkerCache[descriptor].client) {
      console.log(`Reusing cached worker for ${descriptor}`);
      return globalWorkerCache[descriptor];
    }

    // Split the descriptor to get the base name and installation ID
    const [baseName, installationId] = descriptor.split("-");
    const folder = installationId || getNextFolderName();

    const { walletKey, encryptionKey } = this.ensureKeys(descriptor);

    const agentData: AgentBase = {
      name: baseName,
      folder,
      testName: this.testName,
      walletKey,
      encryptionKey,
    };

    const workerClient = new WorkerClient(
      agentData,
      this.typeofStream,
      this.gptEnabled,
    );
    const worker = await workerClient.initialize();

    const agent: Agent = {
      ...agentData,
      client: worker.client,
      dbPath: worker.dbPath,
      version: worker.version,
      address: worker.address,
      installationId: worker.installationId,
      worker: workerClient,
    };

    // Add to global cache for future reuse
    globalWorkerCache[agent.name] = agent;

    // Store the new worker for potential cl  eanup later
    this.activeAgents.push(agent);

    return agent;
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
export async function createAgent(
  descriptorsOrAmount: string[] | number,
  testName: string,
  typeofStream: typeofStream = "message",
  gptEnabled: boolean = false,
  existingPersonas?: AgentManager,
): Promise<AgentManager> {
  let descriptors: string[];
  if (typeof descriptorsOrAmount === "number") {
    const orderedNames = defaultNames.slice(0, descriptorsOrAmount);
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

    return personaFactory.createAgent(finalDescriptor);
  });

  const agentsArray = await Promise.all(personaPromises);

  // If existing personas are provided, add new agents to it and return the updated nested personas
  if (existingPersonas) {
    agentsArray.forEach((agent) => {
      const [baseName, installationId] = agent.name.split("-");
      existingPersonas.addAgent(baseName, installationId || "a", agent);
    });
    return existingPersonas;
  }

  // Convert the array of personas to a nested record
  const agents = agentsArray.reduce<Record<string, Record<string, Agent>>>(
    (acc, agent) => {
      const [baseName, installationId] = agent.name.split("-");

      if (!acc[baseName]) {
        acc[baseName] = {};
      }

      acc[baseName][installationId || "a"] = agent;
      return acc;
    },
    {},
  );

  return new AgentManager(agents);
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
  // First terminate all agents
  for (const key in globalWorkerCache) {
    try {
      // Check if the key exists and has a agent property before trying to terminate
      if (globalWorkerCache[key].worker) {
        await globalWorkerCache[key].worker.terminate();
      }
    } catch (error) {
      console.warn(`Error terminating agent for ${key}:`, error);
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
