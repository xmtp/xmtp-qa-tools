// personas.ts
import { type Client, type XmtpEnv } from "@xmtp/node-sdk";
import { WorkerClient } from "./workerClient";

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
  worker: WorkerClient;
  client: Client;
}

/**
 * Parses a descriptor string like "bobA41" into a Persona.
 */
export function parsePersonaDescriptor(
  descriptor: string,
  defaults: { installationId: string; version: string } = {
    installationId: defaultValues.installationId,
    version: defaultValues.versions,
  },
): { name: string; installationId: string; version: string } {
  // Matches: lowercase letters for name, optional uppercase letter, optional digits.
  const regex = /^([a-z]+)([A-Z])?(\d+)?$/;
  const match = descriptor.match(regex);
  if (!match) {
    throw new Error(`Invalid persona descriptor: ${descriptor}`);
  }
  const [, baseName, inst, ver] = match;
  return {
    name: baseName,
    installationId: inst || defaults.installationId,
    version: ver || defaults.version,
  };
}

/**
 * Given an array of descriptor strings and an environment,
 * initialize a worker for each persona.
 */
export async function getPersonas(
  descriptors: string[],
  env: XmtpEnv,
): Promise<Persona[]> {
  const personas = descriptors.map((desc) => {
    const { name, installationId, version } = parsePersonaDescriptor(desc);
    return { name, installationId, version } as Persona;
  });
  await Promise.all(
    personas.map(async (p) => {
      p.worker = new WorkerClient(p, env);
      p.client = await p.worker.initialize();
    }),
  );
  return personas;
}
