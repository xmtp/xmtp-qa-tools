import { exec } from "child_process";
import { promisify } from "util";
import { type XmtpEnv } from "@xmtp/node-sdk";
import { config } from "dotenv";
import { generatePrivateKey } from "viem/accounts";
import { generateEncryptionKeyHex, getDbPath } from "../client";
import { defaultValues, type Persona, type PersonaBase } from "../types";
import { WorkerClient } from "./streams";

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
    defaults: {
      installationId: string;
      sdkVersion: string;
      libxmtpVersion: string;
    } = {
      installationId: defaultValues.installationId,
      sdkVersion: defaultValues.sdkVersion,
      libxmtpVersion: defaultValues.libxmtpVersion,
    },
  ): {
    name: string;
    installationId: string;
    sdkVersion: string;
    libxmtpVersion: string;
  } {
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
      sdkVersion: ver || defaults.sdkVersion,
      libxmtpVersion: ver || defaults.libxmtpVersion,
    };
    console.timeEnd(`parsePersonaDescriptor:${descriptor}`);
    return result;
  }

  public async createPersonas(descriptors: string[]): Promise<Persona[]> {
    console.time(`createPersonas - ${descriptors.join(",")}`);
    try {
      const personas: Persona[] = [];

      for (const desc of descriptors) {
        console.time(`[${desc}] - processing persona`);
        let personaData: PersonaBase;

        if (desc.toString().includes("random")) {
          const name = desc;
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
          version: "",
        };

        personas.push(persona);
        console.timeEnd(`[${desc}] - processing persona`);
      }

      // Create all workers in parallel
      const workers = await Promise.all(
        Object.values(personas).map((persona) => {
          return new WorkerClient(persona, this.env);
        }),
      );

      const clients = await Promise.all(
        workers.map((worker, index) => {
          return worker.initialize();
        }),
      );

      // Assign workers and clients to personas
      Object.values(personas).forEach((persona, index) => {
        persona.worker = workers[index];
        persona.client = clients[index];

        persona.dbPath = getDbPath(
          persona.name,
          persona.client.accountAddress || "unknown",
          this.env,
          persona.installationId,
          persona.sdkVersion,
          persona.libxmtpVersion,
        );
      });

      console.timeEnd(`createPersonas - ${descriptors.join(",")}`);
      return personas;
    } catch (error) {
      console.timeEnd(`createPersonas - ${descriptors.join(",")}`);
      console.error("Error creating personas:", error);
      throw error;
    }
  }
}

export async function getWorkers(
  descriptors: string[],
  env: XmtpEnv,
  testName: string,
): Promise<Record<string, Persona>> {
  const personaFactory = new PersonaFactory(env, testName);
  const personas = await personaFactory.createPersonas(descriptors);

  return personas.reduce<Record<string, Persona>>((acc, p) => {
    acc[p.name] = p;
    return acc;
  }, {});
}
