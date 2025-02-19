import { beforeAll, describe, it } from "vitest";
import { testLogger } from "../helpers/logger";
import type { TestCase, XmtpEnv } from "../helpers/manager";
import { generateTestCombinations, type Persona } from "../helpers/personas";

const defaultAmount = 1;
const defaultEnvironments = ["dev"] as XmtpEnv[];
const defaultVersions = ["42"];
const defaultInstallationIds = ["a", "b"];
const defaultTimeout = 40000;

export const testsCases: TestCase[] = [
  {
    name: "TC_NewInstallation",
    timeout: defaultTimeout,
    environments: defaultEnvironments,
    versions: defaultVersions,
    amount: defaultAmount,
    installationIds: defaultInstallationIds,
    describe:
      "Test for all version combinations in DMs using a new installation",
    skipVersions: [],
    skipEnvironments: [],
  },
  {
    name: "TC_GroupMessaging",
    timeout: defaultTimeout,
    environments: defaultEnvironments,
    versions: defaultVersions,
    amount: defaultAmount,
    installationIds: defaultInstallationIds,
    describe: "Test for group messaging with different version combinations",
    skipVersions: [],
    skipEnvironments: [],
  },
];
const logger = testLogger.createTest(testsCases[0].name);
describe(testsCases[0].describe, () => {
  generateTestCombinations(testsCases[0], logger, ({ personas }) => {
    let bob: Persona;
    let alice: Persona;
    let bobAddress: string;
    let aliceAddress: string;

    beforeAll(async () => {
      bob = personas[0];
      alice = personas[1];
      [bobAddress, aliceAddress] = await Promise.all([
        bob.worker!.initialize(),
        alice.worker!.initialize(),
      ]);
    });

    it(
      testsCases[0].name,
      async () => {
        try {
          const logger = testLogger.createTest(testsCases[0].name);
          logger.log(
            `[MAIN] Testing DMs with version: {${bob.version}-${bob.installationId}-${bob.env}} and Alice {${alice.version}-${alice.installationId}-${alice.env}}`,
          );
          // Bob creates a DM with Alice
          const dmId = await bob.worker?.createDM(aliceAddress);

          for (let i = 0; i < testsCases[0].amount; i++) {
            const gmMessage =
              "gm-" +
              String(i) +
              "-" +
              Math.random().toString(36).substring(2, 15);
            const receivePromise = bob.worker?.receiveMessage(dmId!, gmMessage);
            await alice.worker?.sendMessage(dmId!, gmMessage);
            await receivePromise;
          }
        } catch (error) {
          console.error("Failed during message exchange:", error);
          throw error;
        }
      },
      testsCases[0].timeout,
    );
  });
});

const groupLogger = testLogger.createTest(testsCases[1].name);
describe(testsCases[1].describe, () => {
  generateTestCombinations(testsCases[1], groupLogger, ({ personas }) => {
    let bob: Persona;
    let alice: Persona;
    let joe: Persona;
    let bobAddress: string;
    let aliceAddress: string;
    let joeAddress: string;

    beforeAll(async () => {
      bob = personas[0];
      alice = personas[1];
      joe = personas[2];
      [bobAddress, aliceAddress, joeAddress] = await Promise.all([
        bob.worker!.initialize(),
        alice.worker!.initialize(),
        joe.worker!.initialize(),
      ]);
    });

    it(
      testsCases[1].name,
      async () => {
        try {
          const logger = testLogger.createTest(testsCases[1].name);
          logger.log(
            `[MAIN] Testing DMs with version: {${bob.version}-${bob.installationId}-${bob.env}} and Alice {${alice.version}-${alice.installationId}-${alice.env}} as well as Joe {${joe.version}-${joe.installationId}-${joe.env}}`,
          );
          const groupId = await bob.worker?.createGroup([
            aliceAddress,
            joeAddress,
            bobAddress,
          ]);

          for (let i = 0; i < testsCases[1].amount; i++) {
            const groupMessage =
              "gm-" +
              String(i) +
              "-" +
              Math.random().toString(36).substring(2, 15);
            const alicePromise = alice.worker?.receiveMessage(
              groupId!,
              groupMessage,
            );
            const joePromise = joe.worker?.receiveMessage(
              groupId!,
              groupMessage,
            );

            await bob.worker?.sendMessage(groupId!, groupMessage);
            logger.log(`Waiting for message from ${alice.name}`);
            await Promise.all([alicePromise, joePromise]);
          }
        } catch (error) {
          console.error("Failed during group messaging test:", error);
          throw error;
        }
      },
      testsCases[1].timeout,
    );
  });
});
