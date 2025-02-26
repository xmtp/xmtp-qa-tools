import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  WorkerNames,
  type Conversation,
  type Persona,
  type XmtpEnv,
} from "../helpers/types";
import { verifyStream } from "../helpers/verify";
import { getWorkers } from "../helpers/workers/factory";

dotenv.config();
const env: XmtpEnv = "dev";
const testName = "TS_Performance_" + env;

const MAX_TEST_DURATION_MS = process.env.GITHUB_ACTIONS ? 1000 : 4000;

// If some of the actions are especially large or complex, you may need to raise the limit.
function expectUnderSeconds(duration: number) {
  // If your environment is slow, increase or remove as needed
  expect(duration).toBeLessThan(MAX_TEST_DURATION_MS);
  console.log(`Test took ${duration}ms`);
}

describe(testName, () => {
  let bobsGroup: Conversation;
  let dmConvo: Conversation;
  let personas: Record<string, Persona>;
  let gmMessageGenerator: (i: number, suffix: string) => Promise<string>;
  let gmSender: (convo: Conversation, message: string) => Promise<void>;

  beforeAll(async () => {
    // Simple generator and sender for "gm" messages.
    gmMessageGenerator = (i: number, suffix: string) => {
      return Promise.resolve(`gm-${i + 1}-${suffix}`);
    };
    gmSender = async (convo: Conversation, message: string) => {
      await convo.send(message);
    };

    const logger = await createLogger(testName);
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

    dmConvo = await personas.bob.client!.conversations.newDm(
      personas.random.client!.accountAddress,
    );

    const end = performance.now();
    const duration = end - start;
    console.log("TC_CreateDM duration:", duration, "ms");

    expect(dmConvo).toBeDefined();
    expect(dmConvo.id).toBeDefined();
    expectUnderSeconds(duration);
  });

  it("TC_SendGM: should measure sending a gm", async () => {
    const start = performance.now();

    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    console.log(
      `[${personas.bob.name}] Creating DM with ${
        personas.sam.name
      } at ${personas.sam.client?.accountAddress}`,
    );

    const dmId = await dmConvo.send(message);

    const end = performance.now();
    const duration = end - start;
    console.log("TC_SendGM duration:", duration, "ms");

    expect(dmId).toBeDefined();
    expectUnderSeconds(duration);
  });

  it("TC_ReceiveGM: should measure receiving a gm", async () => {
    const start = performance.now();

    // Create or fetch the DM conversation with Sam.
    const dmConvoLocal =
      (await personas.bob.client?.conversations.newDm(
        personas.sam.client?.accountAddress as `0x${string}`,
      )) || dmConvo;

    // Wait a bit to let Sam attach stream listeners.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const verifyResult = await verifyStream(
      dmConvoLocal,
      [personas.sam],
      gmMessageGenerator,
      gmSender,
    );

    const end = performance.now();
    const duration = end - start;
    console.log("TC_ReceiveGM duration:", duration, "ms");

    expect(verifyResult.allReceived).toBe(true);
    expectUnderSeconds(duration);
  });

  it("TC_CreateGroup: should measure creating a group", async () => {
    console.time("create group");
    const start = performance.now();

    bobsGroup = await personas.bob.client!.conversations.newGroup(
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
    expectUnderSeconds(duration);
  });

  it("TC_UpdateGroupName: should create a group and update group name", async () => {
    const start = performance.now();
    console.time("update group name");

    const nameUpdateGenerator = (i: number, suffix: string) => {
      return Promise.resolve(`New name-${i + 1}-${suffix}`);
    };

    const nameUpdater = async (group: Conversation, newName: string) => {
      await group.updateName(newName);
    };

    const result = await verifyStream(
      bobsGroup,
      [personas.elon],
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
    expectUnderSeconds(duration);
  });

  it("TC_AddMembers: should measure adding a participant to a group", async () => {
    const start = performance.now();
    console.time("add members");

    const previousMembers = await bobsGroup.members();
    await bobsGroup.addMembers([
      personas.randompep.client?.accountAddress as `0x${string}`,
    ]);
    const members = await bobsGroup.members();

    console.timeEnd("add members");

    const end = performance.now();
    const duration = end - start;
    console.log("TC_AddMembers duration:", duration, "ms");

    expect(members.length).toBe(previousMembers.length + 1);
    expectUnderSeconds(duration);
  });

  it("TC_RemoveMembers: should remove a participant from a group", async () => {
    const start = performance.now();
    console.time("remove members");

    const previousMembers = await bobsGroup.members();
    await bobsGroup.removeMembers([
      personas.joe.client?.accountAddress as `0x${string}`,
    ]);
    const members = await bobsGroup.members();

    console.timeEnd("remove members");

    const end = performance.now();
    const duration = end - start;
    console.log("TC_RemoveMembers duration:", duration, "ms");

    expect(members.length).toBe(previousMembers.length - 1);
    expectUnderSeconds(duration);
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
    expectUnderSeconds(duration);
  });

  it("TC_ReceiveGroupMessage: should measure 1 stream catching up a message in a group", async () => {
    const start = performance.now();

    const verifyResult = await verifyStream(
      bobsGroup,
      [personas.elon],
      gmMessageGenerator,
      gmSender,
    );

    const end = performance.now();
    const duration = end - start;
    console.log("TC_ReceiveGroupMessage (1 stream) duration:", duration, "ms");

    expect(verifyResult.allReceived).toBe(true);
    expectUnderSeconds(duration);
  });

  it("TC_ReceiveGroupMessage: should create a group and measure multiple streams catching a message", async () => {
    const start = performance.now();

    // Create a new group for all personas
    const newGroup = await personas.bob.client!.conversations.newGroup(
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
    expectUnderSeconds(duration);
  });
});
