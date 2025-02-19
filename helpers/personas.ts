import { generatePrivateKey } from "viem/accounts";
import { generateEncryptionKeyHex, getEncryptionKeyFromHex } from "./client";
import { type TestLogger } from "./logger";
import { ClientManager, type TestCase, type XmtpEnv } from "./manager";
import { WorkerClient } from "./worker";

export const defaultValues = {
  amount: 5,
  timeout: 40000,
  versions: "42",
  binding: "37",
  installationId: "a",
  env: "dev" as XmtpEnv,
  names: ["Bob", "Alice", "Joe"],
};
export interface Persona {
  name: string;
  env: string;
  installationId: string;
  version: string;
  address?: string;
  worker?: WorkerClient;
  logger?: TestLogger;
}
/**
 * Generate default personas for tests in a consistent order.
 *
 * @param env - Environment string (e.g., "dev")
 * @param installationId - Installation ID for all personas
 * @param version - Version for all personas
 * @param names - Optional array of names; defaults to ["Bob", "Alice", "Joe"]
 * @returns An array of Persona objects in the fixed order.
 */
export function generateDefaultPersonas(
  personas: Persona[],
  logger: TestLogger,
): Persona[] {
  return personas.map((persona) => {
    return {
      ...persona,
      logger,
      worker: new WorkerClient(persona, logger),
    };
  });
}
export async function getNewRandomPersona() {
  const client = new ClientManager({
    name: "random" + Math.random().toString(36).substring(2, 15),
    env: defaultValues.env,
    installationId: defaultValues.installationId,
    version: defaultValues.versions,
    walletKey: generatePrivateKey(),
    encryptionKey: generateEncryptionKeyHex(),
  });
  await client.initialize();
  return client.client.accountAddress;
}
/**
 * Generate test combinations using different environments, versions, and installation IDs.
 */
export function generateTestCombinations(
  testCase: TestCase,
  logger: TestLogger,
  callback: (params: { personas: Persona[] }) => void,
) {
  testCase.environments.forEach((env) => {
    testCase.installationIds.forEach((installationId) => {
      testCase.versions.forEach((version) => {
        // Use the helper to create personas in the required order
        const personas = generateDefaultPersonas(
          [
            {
              name: "bob",
              env,
              installationId,
              version,
            },
            {
              name: "alice",
              env,
              installationId,
              version,
            },
            {
              name: "joe",
              env,
              installationId,
              version,
            },
            {
              name: "alice",
              env,
              installationId: "b",
              version: "41",
            },
            {
              name: "bob",
              env,
              installationId: "b",
              version: "41",
            },
            {
              name: "carol",
              env,
              installationId: "a",
              version: "42",
            },
            {
              name: "carol",
              env,
              installationId: "b",
              version: "41",
            },
          ],
          logger,
        );
        callback({ personas });
      });
    });
  });
}
