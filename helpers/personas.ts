import { generatePrivateKey } from "viem/accounts";
import { generateEncryptionKeyHex } from "./client";
import { type TestLogger } from "./logger";
import { ClientManager, type XmtpEnv } from "./manager";
import { WorkerClient } from "./worker";

export const defaultValues = {
  amount: 5,
  timeout: 40000,
  versions: "42",
  binding: "37",
  installationId: "a",
  names: ["Bob", "Alice", "Joe"],
};

export interface Persona {
  name: string;
  installationId: string;
  version: string;
  address?: string;
  worker?: WorkerClient;
  logger?: TestLogger;
}

export async function getNewRandomPersona(env: XmtpEnv) {
  const client = new ClientManager({
    name: "random" + Math.random().toString(36).substring(2, 15),
    env,
    installationId: defaultValues.installationId,
    version: defaultValues.versions,
    walletKey: generatePrivateKey(),
    encryptionKey: generateEncryptionKeyHex(),
  });
  await client.initialize();
  return client.client.accountAddress;
}

export type PersonaFilter = Partial<
  Pick<Persona, "name" | "installationId" | "version">
>;
export type PersonaSelection = { [key: string]: PersonaFilter };

/**
 * Initializes the personas matching each filter and returns the full persona object.
 * Uses an index for exact matches to reduce array scans.
 */
export async function initializeSelectedPersonas(
  personas: Persona[],
  selection: PersonaSelection,
): Promise<{ [key: string]: Persona }> {
  // Create an index keyed by "name-installationId-version-env" for faster lookup,
  // but only if all fields are provided.
  const personaIndex = personas.reduce<Record<string, Persona>>((acc, p) => {
    if (p.name && p.installationId && p.version && p.env) {
      const key = `${p.name}-${p.installationId}-${p.version}-${p.env}`;
      acc[key] = p;
    }
    return acc;
  }, {});

  const selected: { [key: string]: Persona } = {};
  await Promise.all(
    Object.entries(selection).map(async ([key, filter]) => {
      let found: Persona | undefined;

      // Attempt fast lookup if filter has all keys.
      if (
        filter.name &&
        filter.installationId &&
        filter.version &&
        filter.env
      ) {
        const lookupKey = `${filter.name}-${filter.installationId}-${filter.version}-${filter.env}`;
        found = personaIndex[lookupKey];
      }

      // Fallback to full array scan if lookup did not succeed.
      if (!found) {
        found = personas.find((p) =>
          Object.entries(filter).every(
            ([prop, value]) => p[prop as keyof Persona] === value,
          ),
        );
      }

      if (!found) {
        throw new Error(
          `No persona found for key "${key}" with filter ${JSON.stringify(filter)}`,
        );
      }
      if (!found.worker) {
        throw new Error(
          `Persona ${key} has no worker. Ensure each Persona has a worker with an initialize method.`,
        );
      }
      // Only initialize if not already done.
      if (!found.address) {
        found.address = await found.worker.initialize();
      }
      selected[key] = found;
    }),
  );
  return selected;
}

// Add these functions in your personas helper file

export function generateDefaultPersonas(
  personas: Persona[],
  env: XmtpEnv,
  logger: TestLogger,
): Persona[] {
  return personas.map((persona) => ({
    ...persona,
    logger,
    worker: new WorkerClient(persona, env, logger),
  }));
}

/**
 * Parses a descriptor string like "bobA41" into a Persona.
 * The descriptor pattern is assumed to be:
 * - Letters for the name (required)
 * - An optional single letter for installationId
 * - An optional number for version
 *
 * Defaults are applied if installationId or version are missing.
 */
export function parsePersonaDescriptor(
  descriptor: string,
  defaults: { installationId: string; version: string } = {
    installationId: defaultValues.installationId,
    version: defaultValues.versions,
  },
): Persona {
  // Updated regex to properly separate name and installation ID
  // Matches: lowercase letters for name, followed by optional uppercase letter, followed by optional numbers
  const regex = /^([a-z]+)([A-Z])?(\d+)?$/;
  const match = descriptor.match(regex);
  if (!match) {
    throw new Error(`Invalid persona descriptor: ${descriptor}`);
  }

  const [, baseName, inst, ver] = match;

  const persona = {
    name: baseName,
    installationId: inst || defaults.installationId, // Will be 'B' for bobB41
    version: ver || defaults.version, // Will be '41' for bobB41
  };

  return persona;
}

/**
 * Generates default personas from an array of descriptor strings.
 * Internally uses `parsePersonaDescriptor` to create Persona objects,
 * then passes them to `generateDefaultPersonas` to add the logger and worker.
 */
export function generatePersonasFromDescriptors(
  descriptors: string[],
  env: XmtpEnv,
  logger: TestLogger,
): Persona[] {
  const personaObjs = descriptors.map((desc) => parsePersonaDescriptor(desc));
  return generateDefaultPersonas(personaObjs, env, logger);
}
export async function getPersonas(
  descriptors: string[],
  env: XmtpEnv,
  logger: TestLogger,
): Promise<Persona[]> {
  const personas = generatePersonasFromDescriptors(descriptors, env, logger);
  await Promise.all(
    personas.map(async (p) => {
      if (!p.address) {
        if (!p.worker) {
          throw new Error(
            `Persona ${p.name} has no worker. Ensure each Persona has a worker with an initialize method.`,
          );
        }
        p.address = await p.worker.initialize();
      }
    }),
  );
  return personas;
}
