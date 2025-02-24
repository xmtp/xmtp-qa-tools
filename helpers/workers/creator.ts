import { exec } from "child_process";
import { promisify } from "util";
import { type Client, type XmtpEnv } from "@xmtp/node-sdk";
import { config } from "dotenv";
import { generatePrivateKey } from "viem/accounts";
import { generateEncryptionKeyHex, getDbPath } from "../client";
import { WorkerClient } from "./client";

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

export interface PersonaBase {
  name: string;
  installationId: string;
  version: string;
  dbPath: string;
  walletKey: string;
  encryptionKey: string;
}

export interface Persona extends PersonaBase {
  worker: WorkerClient | null;
  client: Client | null;
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
    descriptors: (string | DefaultPersonas)[],
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
            version: defaultValues.version,
            walletKey,
            encryptionKey: encryptionKeyHex,
            dbPath: getDbPath(
              name,
              defaultValues.installationId,
              defaultValues.version,
              this.env,
            ),
          };
        } else {
          const { name, installationId, version } = this.parsePersonaDescriptor(
            desc.toString(),
          );
          const { walletKey, encryptionKey } = await this.ensureKeys(name);
          const dbPath = getDbPath(name, installationId, version, this.env);

          if (!dbPath) {
            throw new Error("DB path is required");
          }

          personaData = {
            name,
            installationId,
            version,
            dbPath,
            walletKey,
            encryptionKey,
          };
        }

        const persona: Persona = {
          ...personaData,
          worker: null,
          client: null,
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
  descriptors: (string | DefaultPersonas)[],
  env: XmtpEnv,
  testName: string,
): Promise<Persona[]> {
  const personaFactory = new PersonaFactory(env, testName);
  return personaFactory.getWorkers(descriptors);
}
