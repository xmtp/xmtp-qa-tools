import { exec } from "child_process";
import fs from "fs";
import { promisify } from "util";
import { config } from "dotenv";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { generateEncryptionKeyHex } from "./client";
import type { XmtpEnv } from "./manager";
import { WorkerClient } from "./worker";

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
  env: XmtpEnv;
  testName: string;
  encryptionKey: string;
  walletKey: string;
  dbPath: string;
  inboxId: string;
  address: string;
  worker: WorkerClient | null;
}

// Default personas as an enum
export enum DefaultPersonas {
  ALICE = "alice",
  BOB = "bob",
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

  // Computes the DB path using instance env and reduces repetitive parameters.
  private getDbPath(
    name: string,
    installationId: string,
    version: string,
  ): string {
    const folder = name.includes("random") ? "random" : name.toLowerCase();
    const basePath =
      process.env.RAILWAY_VOLUME_MOUNT_PATH ??
      `${process.cwd()}/.data/${folder}/${name.toLowerCase()}-${installationId}-${version}`;
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
    return `${basePath}/${name.toLowerCase()}-${installationId}-${version}-${this.env}`;
  }

  // Generates keys if missing.
  private async ensureKeys(name: string): Promise<{
    walletKey: string;
    encryptionKey: string;
  }> {
    const walletKeyEnv = `WALLET_KEY_${name.toUpperCase()}`;
    const encryptionKeyEnv = `ENCRYPTION_KEY_${name.toUpperCase()}`;
    if (!process.env[walletKeyEnv] || !process.env[encryptionKeyEnv]) {
      console.log(`Generating keys for ${name}...`);
      try {
        await execAsync(`yarn gen:keys ${name.toLowerCase()}`);
        config();
        return {
          walletKey: process.env[walletKeyEnv] as string,
          encryptionKey: process.env[encryptionKeyEnv] as string,
        };
      } catch (error) {
        throw new Error(
          `Failed to generate keys for ${name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return {
      walletKey: process.env[walletKeyEnv],
      encryptionKey: process.env[encryptionKeyEnv],
    };
  }

  // Parses a descriptor like "bobA41" into a Persona.
  public parsePersonaDescriptor(descriptor: string): {
    name: string;
    installationId: string;
    version: string;
  } {
    const normalized = descriptor.toLowerCase();
    const regex = /^([a-z]+)([a-z])?(\d+)?$/;
    const match = normalized.match(regex);
    if (!match) {
      throw new Error(`Invalid persona descriptor: ${descriptor}`);
    }
    const [, name, installationIdRaw, versionRaw] = match;
    const installationId = installationIdRaw || defaultValues.installationId;
    const version = versionRaw || defaultValues.version;
    const persona = { name, installationId, version };
    return persona;
  }

  // Returns an array of fully initialized personas from descriptors.
  public async getPersonas(
    descriptors: (string | DefaultPersonas)[],
  ): Promise<Persona[]> {
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
        const dbPath = this.getDbPath(
          personasDescriptors.name,
          personasDescriptors.installationId,
          personasDescriptors.version,
        );
        if (!dbPath) {
          throw new Error("DB path is required");
        }
        let personaData: Persona = {
          ...personasDescriptors,
          env: this.env,
          dbPath,
          testName: this.testName,
          inboxId: "",
          address: personasDescriptors.address,
          worker: null,
        };
        const worker = new WorkerClient(personaData);

        const { address, inboxId } = await worker.initialize(personaData);

        personaData = {
          ...personaData,
          address,
          inboxId,
          worker,
        };
        personas.push(personaData);
      }
      return personas;
    } catch (error) {
      console.error("Error getting personas:", error);
      throw error;
    }
  }
}
