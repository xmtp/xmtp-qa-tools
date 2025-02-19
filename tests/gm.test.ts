import { beforeAll, describe, it } from "vitest";
import { testLogger } from "../helpers/logger";
import {
  defaultValues,
  generateDefaultPersonas,
  type Persona,
} from "../helpers/personas";

const TIMEOUT = 30000;

describe("Test for different DM flows", () => {
  // Add beforeAll to initialize personas
  let bob: Persona, alice: Persona, joe: Persona;
  let bobAddress: string, aliceAddress: string, joeAddress: string;

  beforeAll(async () => {
    const logger = testLogger.createTest("Setup");
    [bob, alice, joe] = generateDefaultPersonas(
      [
        {
          name: defaultValues.names[0],
          env: defaultValues.env,
          installationId: defaultValues.installationId,
          version: defaultValues.versions,
        },
        {
          name: defaultValues.names[1],
          env: defaultValues.env,
          installationId: defaultValues.installationId,
          version: defaultValues.versions,
        },
        {
          name: defaultValues.names[2],
          env: defaultValues.env,
          installationId: defaultValues.installationId,
          version: defaultValues.versions,
        },
      ],
      logger,
    );

    // Initialize all workers at once
    [bobAddress, aliceAddress, joeAddress] = await Promise.all([
      bob.worker!.initialize(),
      alice.worker!.initialize(),
      joe.worker!.initialize(),
    ]);
  }, TIMEOUT);

  it(
    "should send a direct message using workers",
    async () => {
      try {
        const testName = "DMs";
        const logger = testLogger.createTest(testName);
        logger.log(
          `Testing DMs with version: ${bob.version}, installationId: ${bob.installationId} | env: ${bob.env}`,
        );
        // Create DM and send message
        const dmId = await bob.worker!.createDM(aliceAddress);

        const gmMessage = "gm-" + Math.random().toString(36).substring(2, 15);

        // Set up receive before send
        const receivePromise = bob.worker?.receiveMessage(dmId, gmMessage);
        await alice.worker?.sendMessage(dmId, gmMessage);

        logger.log(`Waiting for message from ${bob.name}`);
        await receivePromise;
      } catch (error) {
        console.error("Failed during message exchange:", error);
        throw error;
      }
    },
    TIMEOUT,
  );

  it(
    "should send a group message using workers",
    async () => {
      try {
        const testName = "Groups";
        const logger = testLogger.createTest(testName);
        logger.log(
          `Testing groups with version: ${bob.version}, installationId: ${bob.installationId} | env: ${bob.env}`,
        );
        // Create group and send message
        console.time("groupCreationTime");
        const groupId = await bob.worker?.createGroup([
          joeAddress,
          bobAddress,
          aliceAddress,
        ]);
        console.timeEnd("groupCreationTime");

        const groupMessage =
          "hello group " + Math.random().toString(36).substring(2, 15);

        // Set up both Alice and Joe to listen for the group message from Bob
        const alicePromise = alice.worker?.receiveMessage(
          groupId!,
          groupMessage,
        );
        const joePromise = joe.worker?.receiveMessage(groupId!, groupMessage);

        // Bob sends the group message
        await bob.worker?.sendMessage(groupId!, groupMessage);

        logger.log(`Waiting for message from ${alice.name}`);
        await Promise.all([alicePromise, joePromise]);
      } catch (error) {
        console.error("Failed during group messaging test:", error);
        throw error;
      }
    },
    TIMEOUT * 2,
  );
});
