import { type TestLogger } from "./logger";
import type { TestCase } from "./manager";
import { WorkerClient } from "./worker";

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
              name: "Bob",
              env,
              installationId,
              version,
            },
            {
              name: "Alice",
              env,
              installationId,
              version,
            },
            {
              name: "Joe",
              env,
              installationId,
              version,
            },
          ],
          logger,
        );
        callback({ personas });
      });
    });
  });
}
