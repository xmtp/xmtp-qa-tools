import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  WorkerNames,
  type Conversation,
  type Persona,
  type XmtpEnv,
} from "../helpers/types";
import { getWorkers } from "../helpers/workers/creator";
import { verifyStream } from "../helpers/workers/stream";

/**
 * This test suite measures XMTP performance of common actions:
 * - DM creation
 * - Sending / receiving messages
 * - Creating / updating groups
 * - Adding / removing participants
 *
 * Each test includes a performance assertion, verifying that it completes
 * in under 4 seconds (4000ms).
 */

const env: XmtpEnv = "dev";
const testName = "TS_Performance_" + env;

// 4-second limit per test
const MAX_TEST_DURATION_MS = 4000;

// If some of the actions are especially large or complex, you may need to raise the limit.
function expectUnder4Seconds(duration: number) {
  // If your environment is slow, increase or remove as needed
  expect(duration).toBeLessThan(
    MAX_TEST_DURATION_MS,
    `Test took longer than ${MAX_TEST_DURATION_MS}ms`,
  );
}

describe(testName, () => {
  let bobsGroup: Conversation;
  let dmConvo: Conversation;
  let personas: Record<string, Persona>;
  let gmMessageGenerator: (i: number, suffix: string) => Promise<string>;
  let gmSender: (convo: Conversation, message: string) => Promise<void>;

  beforeAll(async () => {
    // Simple generator and sender for "gm" messages.
    gmMessageGenerator = async (i: number, suffix: string) => {
      return `gm-${i + 1}-${suffix}`;
    };
    gmSender = async (convo: Conversation, message: string) => {
      await convo.send(message);
    };

    const logger = createLogger(testName);
    overrideConsole(logger);

    // Spin up workers for the listed personas.
    // If your environment lacks keys, the code may generate them (see getWorkers).
    personas = await getWorkers(
      ["bob", "joe", "sam", "alice", "randompep", "elon", "random"],
      env,
      testName,
    );
  });

  afterAll(async () => {
    await flushLogger(testName);
    await Promise.all(
      Object.values(personas).map(async (persona) => {
        await persona.worker?.terminate();
      }),
    );
  });

  it("TC_CreateDM: should measure creating a DM", async () => {
    const start = performance.now();

    dmConvo = await personas[WorkerNames.BOB].client!.conversations.newDm(
      personas["random"].client!.accountAddress,
    );

    const end = performance.now();
    const duration = end - start;
    console.log("TC_CreateDM duration:", duration, "ms");

    expect(dmConvo).toBeDefined();
    expect(dmConvo.id).toBeDefined();
    expectUnder4Seconds(duration);
  });

  it("TC_SendGM: should measure sending a gm", async () => {
    const start = performance.now();

    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    console.log(
      `[${personas[WorkerNames.BOB].name}] Creating DM with ${
        personas[WorkerNames.SAM].name
      } at ${personas[WorkerNames.SAM].client?.accountAddress}`,
    );

    const dmId = await dmConvo.send(message);

    const end = performance.now();
    const duration = end - start;
    console.log("TC_SendGM duration:", duration, "ms");

    expect(dmId).toBeDefined();
    expectUnder4Seconds(duration);
  });

  it("TC_ReceiveGM: should measure receiving a gm", async () => {
    const start = performance.now();

    // Create or fetch the DM conversation with Sam.
    const dmConvoLocal =
      (await personas[WorkerNames.BOB].client?.conversations.newDm(
        personas[WorkerNames.SAM].client?.accountAddress as `0x${string}`,
      )) || dmConvo;

    if (!dmConvoLocal) {
      throw new Error("DM conversation not found");
    }

    // Wait a bit to let Sam attach stream listeners.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const verifyResult = await verifyStream(
      dmConvoLocal,
      [personas[WorkerNames.SAM]],
      gmMessageGenerator,
      gmSender,
    );

    const end = performance.now();
    const duration = end - start;
    console.log("TC_ReceiveGM duration:", duration, "ms");

    expect(verifyResult.allReceived).toBe(true);
    expectUnder4Seconds(duration);
  });

  it("TC_CreateGroup: should measure creating a group", async () => {
    console.time("create group");
    const start = performance.now();

    bobsGroup = await personas[WorkerNames.BOB].client!.conversations.newGroup(
      Object.values(personas)
        .filter((p) => p.name !== "randompep")
        .map((p) => p.client?.accountAddress as `0x${string}`),
    );

    console.timeEnd("create group");
    console.log("Bob's group:", bobsGroup.id);

    const end = performance.now();
    const duration = end - start;
    console.log("TC_CreateGroup duration:", duration, "ms");

    expect(bobsGroup.id).toBeDefined();
    expectUnder4Seconds(duration);
  });

  it("TC_UpdateGroupName: should create a group and update group name", async () => {
    const start = performance.now();
    console.time("update group name");

    const nameUpdateGenerator = async (i: number, suffix: string) => {
      return `New name-${i + 1}-${suffix}`;
    };

    const nameUpdater = async (group: Conversation, newName: string) => {
      await group.updateName(newName);
    };

    const result = await verifyStream(
      bobsGroup,
      [personas["elon"]],
      nameUpdateGenerator,
      nameUpdater,
      "group_updated",
    );

    console.timeEnd("update group name");

    const end = performance.now();
    const duration = end - start;
    console.log("TC_UpdateGroupName duration:", duration, "ms");
    console.log(result);
    expect(result.allReceived).toBe(true);
    expectUnder4Seconds(duration);
  });

  it("TC_AddMembers: should measure adding a participant to a group", async () => {
    const start = performance.now();
    console.time("add members");

    const previousMembers = await bobsGroup.members();
    await bobsGroup.addMembers([
      personas["randompep"].client?.accountAddress as `0x${string}`,
    ]);
    const members = await bobsGroup.members();

    console.timeEnd("add members");

    const end = performance.now();
    const duration = end - start;
    console.log("TC_AddMembers duration:", duration, "ms");

    expect(members.length).toBe(previousMembers.length + 1);
    expectUnder4Seconds(duration);
  });

  it("TC_RemoveMembers: should remove a participant from a group", async () => {
    const start = performance.now();
    console.time("remove members");

    const previousMembers = await bobsGroup.members();
    await bobsGroup.removeMembers([
      personas[WorkerNames.JOE].client?.accountAddress as `0x${string}`,
    ]);
    const members = await bobsGroup.members();

    console.timeEnd("remove members");

    const end = performance.now();
    const duration = end - start;
    console.log("TC_RemoveMembers duration:", duration, "ms");

    expect(members.length).toBe(previousMembers.length - 1);
    expectUnder4Seconds(duration);
  });

  it("TC_SendGroupMessage: should measure sending a gm in a group", async () => {
    const start = performance.now();

    const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);
    await bobsGroup.send(groupMessage);
    console.log("GM Message sent in group:", groupMessage);

    const end = performance.now();
    const duration = end - start;
    console.log("TC_SendGroupMessage duration:", duration, "ms");

    expect(groupMessage).toBeDefined();
    expectUnder4Seconds(duration);
  });

  it("TC_ReceiveGroupMessage: should measure 1 stream catching up a message in a group", async () => {
    const start = performance.now();

    const verifyResult = await verifyStream(
      bobsGroup,
      [personas["elon"]],
      gmMessageGenerator,
      gmSender,
    );

    const end = performance.now();
    const duration = end - start;
    console.log("TC_ReceiveGroupMessage (1 stream) duration:", duration, "ms");

    expect(verifyResult.allReceived).toBe(true);
    expectUnder4Seconds(duration);
  });

  it("TC_ReceiveGroupMessage: should create a group and measure multiple streams catching a message", async () => {
    const start = performance.now();

    // Create a new group for all personas
    const newGroup = await personas[
      WorkerNames.BOB
    ].client!.conversations.newGroup(
      Object.values(personas).map(
        (p) => p.client?.accountAddress as `0x${string}`,
      ),
    );

    const verifyResult = await verifyStream(
      newGroup,
      Object.values(personas), // all participants
      gmMessageGenerator,
      gmSender,
    );

    const end = performance.now();
    const duration = end - start;
    console.log(
      "TC_ReceiveGroupMessage (multiple streams) duration:",
      duration,
      "ms",
    );

    expect(verifyResult.allReceived).toBe(true);
    expectUnder4Seconds(duration);
  });
});
