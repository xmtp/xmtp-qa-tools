import { exec } from "child_process";
import fs from "fs";
import { promisify } from "util";
import type { Client, XmtpEnv } from "@xmtp/node-sdk";
import { config } from "dotenv";
import { generatePrivateKey } from "viem/accounts";
import { generateEncryptionKeyHex, getDbPath } from "../helpers/client";
import type { WorkerClient } from "../helpers/WorkerClient";
import "../helpers/worker";

const execAsync = promisify(exec);

export const defaultValues = {
  amount: 5,
  timeout: 40000,
  version: "42",
  binding: "37",
  installationId: "a",
};

export interface Persona {
  name: string;
  installationId: string;
  version: string;
  dbPath: string;
  worker: WorkerClient | null;
  client: Client | null;
}

// Default personas as an enum
export enum DefaultPersonas {
  FABRI = "fabri",
  ELON = "elon",
  ALICE = "alice",
  BOB = "bob",
  JOE = "joe",
  CHARLIE = "charlie",
  DAVE = "dave",
  ROSALIE = "rosalie",
  EVE = "eve",
  FRANK = "frank",
  GRACE = "grace",
  HENRY = "henry",
  IVY = "ivy",
  JACK = "jack",
  KAREN = "karen",
  LARRY = "larry",
  MARY = "mary",
  NANCY = "nancy",
  OSCAR = "oscar",
  PAUL = "paul",
  QUINN = "quinn",
  RACHEL = "rachel",
  STEVE = "steve",
  TOM = "tom",
  URSULA = "ursula",
  VICTOR = "victor",
  WENDY = "wendy",
  XAVIER = "xavier",
  YOLANDA = "yolanda",
  ZACK = "zack",
  ADAM = "adam",
  BELLA = "bella",
  CARL = "carl",
  DIANA = "diana",
  ERIC = "eric",
  FIONA = "fiona",
  GEORGE = "george",
  HANNAH = "hannah",
  IAN = "ian",
  JULIA = "julia",
  KEITH = "keith",
  LISA = "lisa",
  MIKE = "mike",
  NINA = "nina",
  OLIVER = "oliver",
  PENNY = "penny",
  QUENTIN = "quentin",
  ROSA = "rosa",
  SAM = "sam",
  TINA = "tina",
  UMA = "uma",
  VINCE = "vince",
  WALT = "walt",
  XENA = "xena",
}

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

  public parsePersonaDescriptor(descriptor: string): {
    name: string;
    installationId: string;
    version: string;
  } {
    console.time(`parsePersonaDescriptor - ${descriptor}`);
    const normalized = descriptor.toLowerCase();
    const regex = /^([a-z]+)([a-z])?(\d+)?$/;
    const match = normalized.match(regex);
    if (!match) {
      console.timeEnd(`parsePersonaDescriptor - ${descriptor}`);
      throw new Error(`Invalid persona descriptor: ${descriptor}`);
    }
    const [, name, installationIdRaw, versionRaw] = match;
    const installationId = installationIdRaw || defaultValues.installationId;
    const version = versionRaw || defaultValues.version;
    const persona = { name, installationId, version };
    console.timeEnd(`parsePersonaDescriptor - ${descriptor}`);
    return persona;
  }

  public async getPersonas(
    descriptors: (string | DefaultPersonas)[],
  ): Promise<Persona[]> {
    console.time(`getPersonas - ${descriptors.join(",")}`);
    try {
      const personas: Persona[] = [];
      let personasDescriptors: {
        name: string;
        installationId: string;
        version: string;
        walletKey: string;
        encryptionKey: string;
      };
      for (const desc of descriptors) {
        console.time(`[${desc}] - processing persona`);
        let name = desc.toString();
        if (desc.toString().includes("random")) {
          const randomId = Math.random().toString(36).slice(2, 15);
          name = `${desc}_${randomId}`;

          const walletKey = generatePrivateKey();
          const encryptionKeyHex = generateEncryptionKeyHex();
          personasDescriptors = {
            name,
            installationId: defaultValues.installationId,
            version: defaultValues.version,
            walletKey,
            encryptionKey: encryptionKeyHex,
          };
        } else {
          const { name, installationId, version } =
            this.parsePersonaDescriptor(desc);
          const { walletKey, encryptionKey } = await this.ensureKeys(name);
          personasDescriptors = {
            name,
            installationId,
            version,
            walletKey,
            encryptionKey,
          };
        }
        const dbPath = getDbPath(
          personasDescriptors.name,
          personasDescriptors.installationId,
          personasDescriptors.version,
        );
        if (!dbPath) {
          throw new Error("DB path is required");
        }
        const personaData: Persona = {
          ...personasDescriptors,
          dbPath,
          worker: null,
          client: null,
        };

        personas.push(personaData);
        console.timeEnd(`[${desc}] - processing persona`);
      }

      // Now working
      const workers = await Promise.all(
        personas.map((persona) => {
          const workerClient = new WorkerClient(persona, this.env);
          return workerClient;
        }),
      );

      //Initialize all workers
      const clients = await Promise.all(
        personas.map((persona) => {
          return persona.worker?.initialize();
        }),
      );
      // Assign workers to personas
      personas.forEach((persona, index) => {
        persona.worker = workers[index];
      });
      // Assign clients to personas
      personas.forEach((persona, index) => {
        persona.client = clients[index] ?? null;
      });

      console.timeEnd(`getPersonas - ${descriptors.join(",")}`);
      return personas;
    } catch (error) {
      console.timeEnd(`getPersonas - ${descriptors.join(",")}`);
      console.error("Error getting personas:", error);
      throw error;
    }
  }
}

export async function getPersonas(
  descriptors: (string | DefaultPersonas)[],
  env: XmtpEnv,
  testName: string,
): Promise<Persona[]> {
  const personaFactory = new PersonaFactory(env, testName);
  return personaFactory.getPersonas(descriptors);
}
