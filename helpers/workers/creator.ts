import { exec } from "child_process";
import { promisify } from "util";
import { type XmtpEnv } from "@xmtp/node-sdk";
import { config } from "dotenv";
import { generatePrivateKey } from "viem/accounts";
import { generateEncryptionKeyHex, getDbPath } from "../client";
import {
  defaultValues,
  type Persona,
  type PersonaBase,
  type WorkerNames,
} from "../types";
import { WorkerClient } from "./client";

const execAsync = promisify(exec);

export class PersonaFactory {
  private env: XmtpEnv;
  private testName: string;

  constructor(env: XmtpEnv, testName: string) {
    this.env = env;
    this.testName = testName;
  }

  private async ensureKeys(name: string): Promise<{
    walletKey: string;
    encryptionKey: string;
  }> {
    console.time(`[${name}] - ensureKeys`);
    const walletKeyEnv = `WALLET_KEY_${name.toUpperCase()}`;
    const encryptionKeyEnv = `ENCRYPTION_KEY_${name.toUpperCase()}`;

    if (!process.env[walletKeyEnv] || !process.env[encryptionKeyEnv]) {
      console.log(`Generating keys for ${name}...`);
      try {
        await execAsync(`yarn gen:keys ${name.toLowerCase()}`);
        config();
        const result = {
          walletKey: process.env[walletKeyEnv] as string,
          encryptionKey: process.env[encryptionKeyEnv] as string,
        };
        console.timeEnd(`[${name}] - ensureKeys`);
        return result;
      } catch (error) {
        console.timeEnd(`[${name}] - ensureKeys`);
        throw new Error(
          `Failed to generate keys for ${name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    const result = {
      walletKey: process.env[walletKeyEnv],
      encryptionKey: process.env[encryptionKeyEnv],
    };
    console.timeEnd(`[${name}] - ensureKeys`);
    return result;
  }

  public parsePersonaDescriptor(
    descriptor: string,
    defaults: { installationId: string; version: string } = {
      installationId: defaultValues.installationId,
      version: defaultValues.version,
    },
  ): { name: string; installationId: string; version: string } {
    console.time(`parsePersonaDescriptor:${descriptor}`);
    const regex = /^([a-z]+)([A-Z])?(\d+)?$/;
    const match = descriptor.match(regex);
    if (!match) {
      throw new Error(`Invalid persona descriptor: ${descriptor}`);
    }
    const [, baseName, inst, ver] = match;
    const result = {
      name: baseName,
      installationId: inst || defaults.installationId,
      version: ver || defaults.version,
    };
    console.timeEnd(`parsePersonaDescriptor:${descriptor}`);
    return result;
  }

  public async getWorkers(
    descriptors: (string | WorkerNames)[],
  ): Promise<Persona[]> {
    console.time(`getWorkers - ${descriptors.join(",")}`);
    try {
      const personas: Persona[] = [];

      for (const desc of descriptors) {
        console.time(`[${desc}] - processing persona`);
        let personaData: PersonaBase;

        if (desc.toString().includes("random")) {
          const randomId = Math.random().toString(36).slice(2, 15);
          const name = `${desc}_${randomId}`;
          const walletKey = generatePrivateKey();
          const encryptionKeyHex = generateEncryptionKeyHex();

          personaData = {
            name,
            installationId: defaultValues.installationId,
            sdkVersion: defaultValues.sdkVersion,
            libxmtpVersion: defaultValues.libxmtpVersion,
            walletKey,
            encryptionKey: encryptionKeyHex,
          };
        } else {
          const { name, installationId } = this.parsePersonaDescriptor(
            desc.toString(),
          );
          const { walletKey, encryptionKey } = await this.ensureKeys(name);

          personaData = {
            name,
            installationId,
            sdkVersion: defaultValues.sdkVersion,
            libxmtpVersion: defaultValues.libxmtpVersion,
            walletKey,
            encryptionKey,
          };
        }

        const persona: Persona = {
          ...personaData,
          worker: null,
          client: null,
          dbPath: "",
          address: "",
        };

        personas.push(persona);
        console.timeEnd(`[${desc}] - processing persona`);
      }

      // Create all workers in parallel
      const workers = await Promise.all(
        personas.map((persona) => new WorkerClient(persona, this.env)),
      );

      // Initialize all clients in parallel
      const clients = await Promise.all(
        workers.map((worker) => worker.initialize()),
      );

      // Assign workers and clients to personas
      personas.forEach((persona, index) => {
        persona.worker = workers[index];
        persona.client = clients[index];
        persona.dbPath = getDbPath(
          persona.name,
          persona.installationId,
          persona.version,
          this.env,
          persona.client.accountAddress,
        );
      });

      console.timeEnd(`getWorkers - ${descriptors.join(",")}`);
      return personas;
    } catch (error) {
      console.timeEnd(`getWorkers - ${descriptors.join(",")}`);
      console.error("Error getting personas:", error);
      throw error;
    }
  }
}

export async function getWorkers(
  descriptors: (string | WorkerNames)[],
  env: XmtpEnv,
  testName: string,
): Promise<Persona[]> {
  const personaFactory = new PersonaFactory(env, testName);
  return personaFactory.getWorkers(descriptors);
}
