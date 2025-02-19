import fs from "fs";
import dotenv from "dotenv";
import { beforeAll, describe, it } from "vitest";
import { type XmtpEnv } from "../helpers/manager";
import { createWorkerPair } from "../helpers/worker";

dotenv.config();

const TIMEOUT = 20000;
const environments: XmtpEnv[] = ["dev"];
const versions = ["41", "42"];
const installationIds = ["a", "b"];

// Configuration object to specify which tests or describe blocks to skip
const config = {
  skipVersions: [
    // Add more version pairs to skip as needed
  ],

  dontSkipDescribeBlocks: [
    "Test for all version combinations in DMs using a new installation",
    "Test for all version combinations in DMs using the same installation",
    "Test version updates on the same installation",
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
    "Test for all version combinations in DMs using a new installation",
  )
) {
  describe("Test for all version combinations in DMs using a new installation", () => {
    beforeAll(() => {
      //Delete the data folder before running all tests for creating new installation but keep the installation as it persists
      fs.rmSync(".data", { recursive: true, force: true });
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
                        const { aliceWorker, bobWorker } = createWorkerPair(
                          new URL("../helpers/worker.ts", import.meta.url),
                        );
                        // Initialize workers
                        const [aliceAddress, bobAddress] = await Promise.all([
                          aliceWorker.initialize({
                            name: "Alice",
                            env: env,
                            installationId: aliceInstallationId,
                            version: aliceVersion,
                          }),
                          bobWorker.initialize({
                            name: "Bob",
                            env: env,
                            installationId: bobInstallationId,
                            version: bobVersion,
                          }),
                        ]);

                        const gmMessage =
                          "gm-" + Math.random().toString(36).substring(2, 15);

                        // Set up receive before send
                        const receivePromise = aliceWorker.receiveMessage(
                          bobAddress,
                          gmMessage,
                        );
                        await new Promise((resolve) =>
                          setTimeout(resolve, 2000),
                        );

                        // Send and wait for completion
                        await bobWorker.sendMessage(aliceAddress, gmMessage);
                        const receivedMessage = await receivePromise;

                        console.log("Message exchange complete:", {
                          sent: gmMessage,
                          received: receivedMessage,
                        });
                      } catch (error) {
                        console.error("Failed during message exchange:", error);
                        throw error;
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
                        const { aliceWorker, bobWorker } = createWorkerPair(
                          new URL("../helpers/worker.ts", import.meta.url),
                        );
                        // Initialize workers
                        const [aliceAddress, bobAddress] = await Promise.all([
                          aliceWorker.initialize({
                            name: "Alice",
                            env: env,
                            installationId: aliceInstallationId,
                            version: aliceVersion,
                          }),
                          bobWorker.initialize({
                            name: "Bob",
                            env: env,
                            installationId: bobInstallationId,
                            version: bobVersion,
                          }),
                        ]);

                        const gmMessage =
                          "gm-" + Math.random().toString(36).substring(2, 15);

                        // Set up receive before send
                        const receivePromise = aliceWorker.receiveMessage(
                          bobAddress,
                          gmMessage,
                        );
                        await new Promise((resolve) =>
                          setTimeout(resolve, 2000),
                        );

                        // Send and wait for completion
                        await bobWorker.sendMessage(aliceAddress, gmMessage);
                        const receivedMessage = await receivePromise;

                        console.log("Message exchange complete:", {
                          sent: gmMessage,
                          received: receivedMessage,
                        });
                      } catch (error) {
                        console.error("Failed during message exchange:", error);
                        throw error;
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
                    const { aliceWorker, bobWorker } = createWorkerPair(
                      new URL("../helpers/worker.ts", import.meta.url),
                    );
                    // Initialize workers
                    const [aliceAddress, bobAddress] = await Promise.all([
                      aliceWorker.initialize({
                        name: "Alice",
                        env: env,
                        installationId: installationId,
                        version: initialVersion,
                      }),
                      bobWorker.initialize({
                        name: "Bob",
                        env: env,
                        installationId: installationId,
                        version: initialVersion,
                      }),
                    ]);

                    const gmMessage =
                      "gm-" + Math.random().toString(36).substring(2, 15);

                    // Set up receive before send
                    const receivePromise = aliceWorker.receiveMessage(
                      bobAddress,
                      gmMessage,
                    );
                    await new Promise((resolve) => setTimeout(resolve, 2000));

                    // Send and wait for completion
                    await bobWorker.sendMessage(aliceAddress, gmMessage);
                    const receivedMessage = await receivePromise;

                    console.log("Message exchange complete:", {
                      sent: gmMessage,
                      received: receivedMessage,
                    });

                    const [aliceAddressUpdated, bobAddressUpdated] =
                      await Promise.all([
                        aliceWorker.initialize({
                          name: "Alice",
                          env: env,
                          installationId: installationId,
                          version: updatedVersion,
                        }),
                        bobWorker.initialize({
                          name: "Bob",
                          env: env,
                          installationId: installationId,
                          version: updatedVersion,
                        }),
                      ]);

                    // Set up receive before send
                    const receivePromiseUpdated = aliceWorker.receiveMessage(
                      bobAddressUpdated,
                      gmMessage,
                    );
                    await new Promise((resolve) => setTimeout(resolve, 2000));

                    // Send and wait for completion
                    await bobWorker.sendMessage(aliceAddressUpdated, gmMessage);
                    const receivedMessageUpdated = await receivePromiseUpdated;

                    console.log("Message exchange complete:", {
                      sent: gmMessage,
                      received: receivedMessageUpdated,
                    });
                  } catch (error) {
                    console.error("Failed during message exchange:", error);
                    throw error;
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
}
