import fs from "fs";
import { appendFile } from "fs/promises";
import path from "path";
import { type XmtpEnv } from "@xmtp/node-sdk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { generateEncryptionKeyHex } from "../client";
import {
  defaultValues,
  type Persona,
  type PersonaBase,
  type typeofStream,
} from "../types";
import { WorkerClient } from "./main";

/**
 * The PersonaFactory is responsible for creating Persona objects
 * and ensuring they each have a WorkerClient + XMTP Client.
 */
export class PersonaFactory {
  private env: XmtpEnv;
  private testName: string;
  private activeWorkers: WorkerClient[] = []; // Add this to track workers

  private typeofStream: typeofStream;
  constructor(env: XmtpEnv, testName: string, typeofStream: typeofStream) {
    this.env = env;
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

      // Keys exist in env, use them
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
      void appendFile(
        process.env.CURRENT_ENV_PATH || path.resolve(process.cwd(), ".env"),
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

    for (const desc of descriptors) {
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

      personas.push({
        ...personaData,
        worker: null,
        client: null,
        dbPath: "",
        address: "",
        version: "",
      });
    }

    // Spin up Workers in parallel
    const messageWorkers = await Promise.all(
      personas.map((p) => new WorkerClient(p, this.env, this.typeofStream)),
    );

    // Initialize each worker's XMTP client in parallel
    const workers = await Promise.all([
      ...messageWorkers.map((w) => w.initialize()),
    ]);

    personas.forEach((p, index) => {
      p.client = workers[index].client;
      p.dbPath = workers[index].dbPath;
      p.version = workers[index].version;
      p.worker = messageWorkers[index];
    });

    // Store the workers for potential cleanup later
    this.activeWorkers = messageWorkers;

    return personas;
  }
}

/**
 * Helper function to create a keyed record of Persona objects from descriptors.
 * This is useful if you want something like:
 *   { alice: Persona, bob: Persona }
 *
 * @param descriptors e.g. ["aliceA12", "bob", "random1"]
 * @param env         The XMTP environment to use
 * @param testName    Not currently used, but can be used for labeling or logging
 */
export async function getWorkers(
  descriptorsOrAmount: string[] | number,
  env: XmtpEnv,
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

  const personaFactory = new PersonaFactory(env, testName, typeofStream);

  const personas = await personaFactory.createPersonas(descriptors);

  return personas.reduce<Record<string, Persona>>((acc, p) => {
    // Use the full descriptor as the key in the returned object
    acc[p.name] = p;
    return acc;
  }, {});
}

export function getDataSubFolderCount() {
  const preBasePath = process.cwd();
  return fs.readdirSync(`${preBasePath}/.data`).length;
}

export async function createMultipleInstallations(
  persona: Persona,
  suffixes: string[],
  env: string,
  testName: string,
): Promise<Record<string, Persona>> {
  // Create installations with different IDs for the same persona
  const installations: Record<string, Persona> = {};

  for (const suffix of suffixes) {
    const installId = `${persona.name}-${suffix}`;

    // Create worker with the installation ID
    const installations = await getWorkers(
      [installId],
      env as XmtpEnv,
      testName,
      "none",
    );

    installations[installId] = Object.values(installations)[0];
  }

  return installations;
}
