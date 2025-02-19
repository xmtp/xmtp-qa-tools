import fs from "fs";
import dotenv from "dotenv";
import { beforeAll, describe, it } from "vitest";
import { type XmtpEnv } from "../helpers/manager";
import { createWorkerPair } from "../helpers/worker";

dotenv.config();

const TIMEOUT = 40000;
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

type Worker = {
  worker: {
    receiveMessage: (address: string, message: string) => Promise<string>;
    sendMessage: (address: string, message: string) => Promise<void>;
    initialize: (config: {
      name: string;
      env: XmtpEnv;
      installationId: string;
      version: string;
    }) => Promise<string>;
  };
  address: string;
  env: XmtpEnv;
  version: string;
  installationId: string;
};

const workerCache = new Map<string, Worker>();

async function getOrCreateWorker(
  name: "Alice" | "Bob",
  env: XmtpEnv,
  version: string,
  installationId: string,
): Promise<Worker> {
  const key = `${name}-${env}-${version}-${installationId}`;
  if (workerCache.has(key)) {
    return workerCache.get(key)!;
  }

  const { aliceWorker, bobWorker } = createWorkerPair(
    new URL("../helpers/worker.ts", import.meta.url),
  );
  const worker = name === "Alice" ? aliceWorker : bobWorker;

  const address = await worker.initialize({
    name,
    env,
    installationId,
    version,
  });

  const workerInstance: Worker = {
    worker,
    address,
    env,
    version,
    installationId,
  };

  workerCache.set(key, workerInstance);
  return workerInstance;
}

// Example of how to use in tests
if (
  !shouldSkipDescribe(
    "Test for all version combinations in DMs using a new installation",
  )
) {
  describe("Test for all version combinations in DMs using a new installation", () => {
    beforeAll(() => {
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
                        const bob = await getOrCreateWorker(
                          "Bob",
                          env,
                          bobVersion,
                          bobInstallationId,
                        );
                        const alice = await getOrCreateWorker(
                          "Alice",
                          env,
                          aliceVersion,
                          aliceInstallationId,
                        );

                        const gmMessage =
                          "gm-" + Math.random().toString(36).substring(2, 15);

                        // Set up receive before send
                        const receivePromise = alice.worker.receiveMessage(
                          bob.address,
                          gmMessage,
                        );
                        await new Promise((resolve) =>
                          setTimeout(resolve, 2000),
                        );

                        // Send and wait for completion
                        await bob.worker.sendMessage(alice.address, gmMessage);
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
                        const bob = await getOrCreateWorker(
                          "Bob",
                          env,
                          bobVersion,
                          bobInstallationId,
                        );
                        const alice = await getOrCreateWorker(
                          "Alice",
                          env,
                          aliceVersion,
                          aliceInstallationId,
                        );

                        const gmMessage =
                          "gm-" + Math.random().toString(36).substring(2, 15);

                        // Set up receive before send
                        const receivePromise = alice.worker.receiveMessage(
                          bob.address,
                          gmMessage,
                        );
                        await new Promise((resolve) =>
                          setTimeout(resolve, 2000),
                        );

                        // Send and wait for completion
                        await bob.worker.sendMessage(alice.address, gmMessage);
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
                    const bob = await getOrCreateWorker(
                      "Bob",
                      env,
                      initialVersion,
                      installationId,
                    );
                    const alice = await getOrCreateWorker(
                      "Alice",
                      env,
                      initialVersion,
                      installationId,
                    );

                    const gmMessage =
                      "gm-" + Math.random().toString(36).substring(2, 15);

                    // Set up receive before send
                    const receivePromise = alice.worker.receiveMessage(
                      bob.address,
                      gmMessage,
                    );
                    await new Promise((resolve) => setTimeout(resolve, 2000));

                    // Send and wait for completion
                    await bob.worker.sendMessage(alice.address, gmMessage);
                    const receivedMessage = await receivePromise;

                    console.log("Message exchange complete:", {
                      sent: gmMessage,
                      received: receivedMessage,
                    });

                    const bobUpdated = await getOrCreateWorker(
                      "Bob",
                      env,
                      updatedVersion,
                      installationId,
                    );
                    const aliceUpdated = await getOrCreateWorker(
                      "Alice",
                      env,
                      updatedVersion,
                      installationId,
                    );

                    // Set up receive before send
                    const receivePromiseUpdated =
                      aliceUpdated.worker.receiveMessage(
                        bobUpdated.address,
                        gmMessage,
                      );
                    await new Promise((resolve) => setTimeout(resolve, 2000));

                    // Send and wait for completion
                    await bobUpdated.worker.sendMessage(
                      aliceUpdated.address,
                      gmMessage,
                    );
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
