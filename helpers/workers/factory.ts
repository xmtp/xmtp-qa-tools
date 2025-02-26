import { appendFile } from "fs/promises";
import path from "path";
import { type XmtpEnv } from "@xmtp/node-sdk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { generateEncryptionKeyHex } from "../client";
import {
  defaultValues,
  WorkerNames,
  type Persona,
  type PersonaBase,
} from "../types";
import { WorkerClient } from "./main";

/**
 * The PersonaFactory is responsible for creating Persona objects
 * and ensuring they each have a WorkerClient + XMTP Client.
 */
export class PersonaFactory {
  private env: XmtpEnv;
  private testName: string;

  constructor(env: XmtpEnv, testName: string) {
    this.env = env;
    this.testName = testName;
  }

  /**
   * Ensure a particular persona (by name) has a wallet key and encryption key.
   * If these are not found in the environment variables, generate them via a yarn script.
   */
  private async ensureKeys(
    name: string,
  ): Promise<{ walletKey: string; encryptionKey: string }> {
    const walletKeyEnv = `WALLET_KEY_${name.toUpperCase()}`;
    const encryptionKeyEnv = `ENCRYPTION_KEY_${name.toUpperCase()}`;

    // If not already in .env, generate them.
    if (!process.env[walletKeyEnv] || !process.env[encryptionKeyEnv]) {
      const walletKey = generatePrivateKey();
      const account = privateKeyToAccount(walletKey);
      const encryptionKeyHex = generateEncryptionKeyHex();
      const publicKey = account.address;
      // Append a new environment variable to the .data/.env file
      await appendFile(
        path.resolve(process.cwd(), ".env"),
        `\n${walletKeyEnv}=${walletKey}\n${encryptionKeyEnv}=${encryptionKeyHex}\n# public key is ${publicKey}\n`,
      );
      return {
        walletKey,
        encryptionKey: encryptionKeyHex,
      };
    }

    return {
      walletKey: process.env[walletKeyEnv],
      encryptionKey: process.env[encryptionKeyEnv],
    };
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
    const regex = /^([a-z]+)([A-Z])?(\d+)?$/;
    const match = descriptor.match(regex);

    if (!match) {
      throw new Error(
        `[PersonaFactory] Invalid persona descriptor: ${descriptor}`,
      );
    }

    const [, baseName, inst, ver] = match;
    return {
      name: baseName,
      installationId: inst || defaults.installationId,
      sdkVersion: ver || defaults.sdkVersion,
    };
  }

  /**
   * Creates an array of Persona objects from the given descriptors.
   * Each persona either has pre-existing keys (if the descriptor is "alice", etc.)
   * or random keys (if descriptor includes "random").
   * Then spins up a WorkerClient for each persona, initializes it,
   * and returns the complete Persona array.
   */
  public async createPersonas(descriptors: string[]): Promise<Persona[]> {
    console.log(
      `[PersonaFactory] Creating personas: ${descriptors.join(", ")} for ${this.testName}`,
    );
    const personas: Persona[] = [];

    for (const desc of descriptors) {
      const isRandom = desc.includes("random");
      let personaData: PersonaBase;

      if (isRandom) {
        // Generate ephemeral keys
        const walletKey = generatePrivateKey();
        const encryptionKeyHex = generateEncryptionKeyHex();

        personaData = {
          name: desc,
          testName: this.testName,
          installationId: defaultValues.installationId,
          sdkVersion: defaultValues.sdkVersion,
          walletKey,
          encryptionKey: encryptionKeyHex,
        };
      } else {
        // Use or generate keys from environment
        const { name, installationId, sdkVersion } =
          this.parsePersonaDescriptor(desc);
        const { walletKey, encryptionKey } = await this.ensureKeys(name);

        personaData = {
          name,
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
      personas.map((p) => new WorkerClient(p, this.env)),
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
): Promise<Record<string, Persona>> {
  let descriptors: string[];
  if (typeof descriptorsOrAmount === "number") {
    const workerNames = Object.values(WorkerNames);
    const orderedNames = workerNames.slice(0, descriptorsOrAmount);
    descriptors = orderedNames;
  } else {
    descriptors = descriptorsOrAmount;
  }

  const personaFactory = new PersonaFactory(env, testName);
  const personas = await personaFactory.createPersonas(descriptors);

  return personas.reduce<Record<string, Persona>>((acc, p) => {
    acc[p.name] = p;
    return acc;
  }, {});
}
