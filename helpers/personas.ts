import { exec } from "child_process";
import fs from "fs";
import fsPromises from "fs/promises";
import { join } from "path";
import { promisify } from "util";
import { config } from "dotenv";
import { generatePrivateKey } from "viem/accounts";
import { generateEncryptionKeyHex } from "./client";
import { ClientManager, type XmtpEnv } from "./manager";
import { WorkerClient } from "./worker";

const execAsync = promisify(exec);

// Constants
export const defaultValues = {
  amount: 5,
  timeout: 40000,
  versions: "42",
  binding: "37",
  installationId: "a",
};

// Types
export interface Persona {
  name: string;
  installationId: string;
  inboxId?: string;
  version: string;
  address?: string;
  worker?: WorkerClient;
  dbPath: string;
}

export type PersonaFilter = Partial<
  Pick<Persona, "name" | "installationId" | "version">
>;
export type PersonaSelection = Record<string, PersonaFilter>;

/**
 * Creates a new random persona for testing purposes
 */
export async function getNewRandomPersona(env: XmtpEnv) {
  const randomId = Math.random().toString(36).slice(2, 15);
  const name = `random_${randomId}`;

  const clientManager = new ClientManager({
    name,
    env,
    installationId: defaultValues.installationId,
    version: defaultValues.versions,
    walletKey: generatePrivateKey(),
    encryptionKey: generateEncryptionKeyHex(),
    dbPath: dbPath(
      name,
      defaultValues.installationId,
      env,
      defaultValues.versions,
    ),
  });

  await clientManager.initialize();

  const randomDir = join(process.cwd(), "random");
  await fsPromises.mkdir(randomDir, { recursive: true });

  const personaData = {
    name,
    address: clientManager.client.accountAddress,
    inboxId: clientManager.client.inboxId,
    timestamp: new Date().toISOString(),
  };

  await fsPromises.writeFile(
    join(randomDir, `${name}.json`),
    JSON.stringify(personaData, null, 2),
  );

  return {
    address: clientManager.client.accountAddress,
    inboxId: clientManager.client.inboxId,
  };
}

/**
 * Parses a descriptor string like "bobA41" or "bob-b41" into a Persona.
 * Also handles db path formatting.
 */
export function parsePersonaDescriptor(descriptor: string): {
  name: string;
  installationId: string;
  version: string;
} {
  // Convert the descriptor to lowercase before matching
  const normalized = descriptor.toLowerCase();

  // Regex to match: name + optional installation ID (a-z) + optional version number
  const regex = /^([a-z]+)([a-z])?(\d+)?$/;
  const match = normalized.match(regex);

  if (!match) {
    throw new Error(`Invalid persona descriptor: ${descriptor}`);
  }

  const [, name, installationId, version] = match;

  const persona = {
    name,
    installationId: installationId || defaultValues.installationId,
    version: version || defaultValues.versions,
  };

  return persona;
}

/**
 * Main function to get initialized personas from descriptors
 */
export async function getPersonas(
  descriptors: string[],
  env: XmtpEnv,
  testName: string,
  maxPersonas: number,
): Promise<Persona[]> {
  // First generate keys for the necessary personas
  let count = 0;
  for (const desc of descriptors) {
    const personaDesc = parsePersonaDescriptor(desc);
    const walletKeyEnv = `WALLET_KEY_${personaDesc.name.toUpperCase()}`;
    const encryptionKeyEnv = `ENCRYPTION_KEY_${personaDesc.name.toUpperCase()}`;

    if (!process.env[walletKeyEnv] || !process.env[encryptionKeyEnv]) {
      console.log(`Generating keys for ${personaDesc.name}...`);
      try {
        await execAsync(`yarn gen:keys ${personaDesc.name.toLowerCase()}`);
        // Reload environment variables after generating keys
        config();
      } catch (error) {
        throw new Error(
          `Failed to generate keys for ${personaDesc.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (count >= maxPersonas) {
      break;
    }
    count++;
  }

  // Limit the descriptors array to maxPersonas before mapping
  const limitedDescriptors = descriptors.slice(0, maxPersonas);

  const personas = limitedDescriptors.map((desc) => {
    const personaData = parsePersonaDescriptor(desc);
    const fullDbPath = dbPath(
      personaData.name,
      personaData.installationId,
      env,
      personaData.version,
    );
    return {
      ...personaData,
      dbPath: fullDbPath,
      worker: new WorkerClient(personaData, env, fullDbPath),
    };
  });

  await Promise.all(
    personas.map(async (persona: Persona) => {
      if (!persona.worker) {
        throw new Error(`Missing worker for persona: ${persona.name}`);
      }

      if (!persona.address) {
        const { address, inboxId } = await persona.worker.initialize(testName);
        persona.address = address;
        persona.inboxId = inboxId;
      }
    }),
  );

  return personas;
}

/**
 * Returns a random selection of personas from the given array
 * @param personas Array of personas to select from
 * @param count Number of personas to return (defaults to 1)
 * @returns Array of randomly selected personas
 */
export function getRandomPersonas(
  personas: Persona[],
  count: number = 1,
): Persona[] {
  if (count > personas.length) {
    throw new Error(
      `Cannot select ${count} personas from a list of ${personas.length}`,
    );
  }

  // Create a copy of the array to avoid modifying the original
  const shuffled = [...personas];

  // Fisher-Yates shuffle algorithm
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

export const participantNames = [
  "alice",
  "bob",
  "charlie",
  "dave",
  "eve",
  "frank",
  "grace",
  "henry",
  "ivy",
  "jack",
  "karen",
  "larry",
  "mary",
  "nancy",
  "oscar",
  "paul",
  "quinn",
  "rachel",
  "steve",
  "tom",
  "ursula",
  "victor",
  "wendy",
  "xavier",
  "yolanda",
  "zack",
  "adam",
  "bella",
  "carl",
  "diana",
  "eric",
  "fiona",
  "george",
  "hannah",
  "ian",
  "julia",
  "keith",
  "lisa",
  "mike",
  "nina",
  "oliver",
  "penny",
  "quentin",
  "rosa",
  "sam",
  "tina",
  "uma",
  "vince",
  "walt",
  "xena",
];

export const dbPath = (
  name: string,
  installationName: string,
  env: string,
  version: string,
): string => {
  try {
    const folder = name.includes("random") ? "random" : name.toLowerCase();
    const volumePath =
      process.env.RAILWAY_VOLUME_MOUNT_PATH ??
      `${process.cwd()}/.data/${folder}/${name.toLowerCase()}-${installationName}-${version}`;

    if (!fs.existsSync(volumePath)) {
      fs.mkdirSync(volumePath, { recursive: true });
    }

    const dbPath = `${volumePath}/${name.toLowerCase()}-${installationName}-${version}-${env}`;
    return dbPath;
  } catch (error) {
    console.error(
      `Error creating dbPath for ${name} ${installationName} ${env}:`,
      error,
    );
    throw error;
  }
};
