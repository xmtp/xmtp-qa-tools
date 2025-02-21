import { exec } from "child_process";
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
  names: ["Bob", "Alice", "Joe"],
} as const;

// Types
export interface Persona {
  name: string;
  installationId: string;
  inboxId?: string;
  version: string;
  address?: string;
  worker?: WorkerClient;
}

export type PersonaFilter = Partial<
  Pick<Persona, "name" | "installationId" | "version">
>;
export type PersonaSelection = Record<string, PersonaFilter>;

/**
 * Creates a new random persona for testing purposes
 */
export async function getNewRandomPersona(env: XmtpEnv) {
  const client = new ClientManager({
    name: `random_${Math.random().toString(36).slice(2, 15)}`,
    env,
    installationId: defaultValues.installationId,
    version: defaultValues.versions,
    walletKey: generatePrivateKey(),
    encryptionKey: generateEncryptionKeyHex(),
  });

  await client.initialize();
  return {
    address: client.client.accountAddress,
    inboxId: client.client.inboxId,
  };
}

/**
 * Parses a descriptor string like "bobA41" into a Persona.
 */
export function parsePersonaDescriptor(
  descriptor: string,
  defaults = {
    installationId: defaultValues.installationId,
    version: defaultValues.versions,
  },
): Persona {
  const regex = /^([a-z]+)([A-Z])?(\d+)?$/;
  const match = descriptor.match(regex);

  if (!match) {
    throw new Error(`Invalid persona descriptor: ${descriptor}`);
  }

  const [, name, installationId, version] = match;

  return {
    name: name.toLowerCase(),
    installationId: (installationId || defaults.installationId).toLowerCase(),
    version: version || defaults.version,
  };
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
  // First check and generate any missing keys
  let count = 0;
  for (const desc of descriptors) {
    const persona = parsePersonaDescriptor(desc);
    const walletKeyEnv = `WALLET_KEY_${persona.name.toUpperCase()}`;
    const encryptionKeyEnv = `ENCRYPTION_KEY_${persona.name.toUpperCase()}`;

    if (!process.env[walletKeyEnv] || !process.env[encryptionKeyEnv]) {
      console.log(`Generating keys for ${persona.name}...`);
      try {
        await execAsync(`yarn gen:keys ${persona.name.toLowerCase()}`);
        // Reload environment variables after generating keys
        config();
      } catch (error) {
        throw new Error(
          `Failed to generate keys for ${persona.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (count >= maxPersonas) {
      break;
    }
    count++;
  }

  const personas = descriptors.map((desc) => ({
    ...parsePersonaDescriptor(desc),
    worker: new WorkerClient(parsePersonaDescriptor(desc), env),
  }));
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
