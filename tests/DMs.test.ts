import dotenv from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";
import { ClientManager, type XmtpEnv } from "../helpers/manager";

dotenv.config();

const TIMEOUT = 20000;
const environments: XmtpEnv[] = ["dev"];
const versions = ["40", "41", "42"];
const installationIds = ["a", "b"];

// Configuration object to specify which tests or describe blocks to skip
const config = {
  skipVersions: [
    // Add more version pairs to skip as needed
  ],

  dontSkipDescribeBlocks: [
    "Test for all version combinations in DMs using the same installation",
    //"Test for all version combinations in DMs using a new installation",
    //"Test version updates on the same installation",
  ],
};

// Function to check if a test should be skipped based on version flow
function shouldSkipVersionFlow(bobVersion: string, aliceVersion: string) {
  return config.skipVersions.some(
    (versionPair) =>
      versionPair.origin === bobVersion && versionPair.destiny === aliceVersion,
  );
}

// Function to check if a describe block should be skipped
function shouldSkipDescribe(title: string) {
  return !config.dontSkipDescribeBlocks.includes(title);
}

if (
  !shouldSkipDescribe(
    "Test for all version combinations in DMs using the same installation",
  )
) {
  describe("Test for all version combinations in DMs using the same installation", () => {
    beforeAll(() => {});

    environments.forEach((env) => {
      installationIds.forEach((bobInstallationId, bobInstallIndex) => {
        installationIds
          .slice(bobInstallIndex + 1)
          .forEach((aliceInstallationId) => {
            versions.forEach((bobVersion) => {
              versions.forEach((aliceVersion) => {
                if (
                  (bobVersion !== aliceVersion ||
                    bobInstallationId !== aliceInstallationId) &&
                  !shouldSkipVersionFlow(bobVersion, aliceVersion)
                ) {
                  const testName = `Bob (version: ${bobVersion}, installationId: ${bobInstallationId}) -> Alice (version: ${aliceVersion}, installationId: ${aliceInstallationId}) with env: ${env}`;
                  it(
                    testName,
                    async () => {
                      try {
                        const bob = new ClientManager({
                          env,
                          version: bobVersion,
                          name: "Bob",
                          installationId: bobInstallationId,
                        });

                        const alice = new ClientManager({
                          env,
                          version: aliceVersion,
                          name: "Alice",
                          installationId: aliceInstallationId,
                        });

                        await bob.initialize();
                        await alice.initialize();

                        // Bob sends, Alice receives
                        const success =
                          await ClientManager.sendMessageAndVerify(bob, alice);
                        expect(success).toBe(true);
                      } catch (error) {
                        console.error(
                          `Error in test case for Bob (version: ${bobVersion}, installationId: ${bobInstallationId}) -> Alice (version: ${aliceVersion}, installationId: ${aliceInstallationId}):`,
                          error,
                        );
                        throw error; // Rethrow the error to ensure the test fails
                      }
                    },
                    TIMEOUT,
                  );
                }
              });
            });
          });
      });
    });
  });
}

if (
  !shouldSkipDescribe(
    "Test for all version combinations in DMs using a new installation",
  )
) {
  describe("Test for all version combinations in DMs using a new installation", () => {
    beforeAll(() => {
      //Delete the data folder before running all tests for creating new installation but keep the installation as it persists
      //fs.rmSync(".data", { recursive: true, force: true });
    });

    environments.forEach((env) => {
      installationIds.forEach((bobInstallationId, bobInstallIndex) => {
        installationIds
          .slice(bobInstallIndex + 1)
          .forEach((aliceInstallationId) => {
            versions.forEach((bobVersion) => {
              versions.forEach((aliceVersion) => {
                if (
                  (bobVersion !== aliceVersion ||
                    bobInstallationId !== aliceInstallationId) &&
                  !shouldSkipVersionFlow(bobVersion, aliceVersion)
                ) {
                  const testName = `Bob (version: ${bobVersion}, installationId: ${bobInstallationId}) -> Alice (version: ${aliceVersion}, installationId: ${aliceInstallationId}) with env: ${env}`;

                  it(
                    testName,
                    async () => {
                      try {
                        const bob = new ClientManager({
                          env,
                          version: bobVersion,
                          name: "Bob",
                          installationId: bobInstallationId,
                        });

                        const alice = new ClientManager({
                          env,
                          version: aliceVersion,
                          name: "Alice",
                          installationId: aliceInstallationId,
                        });

                        await bob.initialize();
                        await alice.initialize();

                        const success =
                          await ClientManager.sendMessageAndVerify(bob, alice);

                        expect(success).toBe(true);
                      } catch (error) {
                        console.error(
                          `Error in test case for Bob (version: ${bobVersion}, installationId: ${bobInstallationId}) -> Alice (version: ${aliceVersion}, installationId: ${aliceInstallationId}):`,
                          error,
                        );
                        throw error; // Rethrow the error to ensure the test fails
                      }
                    },
                    TIMEOUT,
                  );
                }
              });
            });
          });
      });
    });
  });
}

if (!shouldSkipDescribe("Test version updates on the same installation")) {
  describe("Test version updates on the same installation", () => {
    beforeAll(() => {
      // Ensure the data folder is clean before running tests
      //fs.rmSync(".data", { recursive: true, force: true });
    });

    environments.forEach((env) => {
      installationIds.forEach((installationId) => {
        versions.forEach((initialVersion, index) => {
          versions.slice(index + 1).forEach((updatedVersion) => {
            if (
              (initialVersion !== updatedVersion ||
                installationId !== installationId) &&
              !shouldSkipVersionFlow(initialVersion, updatedVersion)
            ) {
              it(
                `updates from version: ${initialVersion} to version: ${updatedVersion} on installationId: ${installationId} with env: ${env}`,
                async () => {
                  try {
                    const bob = new ClientManager({
                      env,
                      version: initialVersion,
                      name: "Bob",
                      installationId,
                    });

                    const alice = new ClientManager({
                      env,
                      version: updatedVersion,
                      name: "Alice",
                      installationId,
                    });

                    await bob.initialize();
                    await alice.initialize();
                    const success = await ClientManager.sendMessageAndVerify(
                      bob,
                      alice,
                    );

                    // Simulate version update
                    const bobUpdated = new ClientManager({
                      env,
                      version: updatedVersion,
                      name: "Bob",
                      installationId,
                    });
                    await bobUpdated.initialize();
                    const successUpdated =
                      await ClientManager.sendMessageAndVerify(
                        bobUpdated,
                        alice,
                      );

                    expect(success).toBe(true);
                    expect(successUpdated).toBe(true);
                  } catch (error) {
                    console.error(
                      `Error in test case for Bob (version: ${initialVersion}, installationId: ${installationId}) -> Alice (version: ${updatedVersion}, installationId: ${installationId}):`,
                      error,
                    );
                    throw error; // Rethrow the error to ensure the test fails
                  }
                },
                TIMEOUT * 2,
              );
            }
          });
        });
      });
    });
  });
}
