import { generatePrivateKey } from "viem/accounts";
import { generateEncryptionKeyHex } from "./client";
import { ClientManager, type XmtpEnv } from "./manager";
import { WorkerClient } from "./worker";

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
    name,
    installationId: installationId || defaults.installationId,
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
): Promise<Persona[]> {
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
