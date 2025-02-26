import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { WorkerNames, type Conversation, type Persona } from "../helpers/types";
import { verifyStream } from "../helpers/verify";
import { getWorkers } from "../helpers/workers/creator";

dotenv.config();
/* 
TODO:
  - Percentge of missed?
  - Ensure streams recover correctly.
  - Handling repeated paralell dual streams.
  - Test different type of streams for users.
  - Timeout?
  - Installations
  - Multiple installations.
  - Multiple clients from the same installation.
*/

const env = "dev";
const testName = "TS_Streams_" + env;

describe(testName, () => {
  let personas: Record<string, Persona>;
  let gmMessageGenerator: (i: number, suffix: string) => Promise<string>;
  let gmSender: (convo: Conversation, message: string) => Promise<void>;

  beforeAll(async () => {
    gmMessageGenerator = async (i: number, suffix: string) => {
      return `gm-${i + 1}-${suffix}`;
    };
    gmSender = async (convo: Conversation, message: string) => {
      await convo.send(message);
    };
    const logger = await createLogger(testName);
    overrideConsole(logger);
    personas = await getWorkers(
      ["bob", "joe", "elon", "fabri", "alice"],
      "dev",
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
  it("test fabri sending gm to alice", async () => {
    const dmConvo = await personas[
      WorkerNames.FABRI
    ].client?.conversations.newDm(
      personas[WorkerNames.ALICE].client?.accountAddress as `0x${string}`,
    );
    if (!dmConvo) {
      throw new Error("DM conversation not found");
    }
    const result = await verifyStream(
      dmConvo,
      [personas[WorkerNames.ALICE]],
      gmMessageGenerator,
      gmSender,
    );
    expect(result.allReceived).toBe(true);
  }); // Increase timeout if needed

  it("test fabri sending gm to alice", async () => {
    const dmConvo = await personas["fabri"].client?.conversations.newDm(
      personas["alice"].client?.accountAddress as `0x${string}`,
    );
    if (!dmConvo) {
      throw new Error("DM conversation not found");
    }
    const result = await verifyStream(
      dmConvo,
      [personas["alice"]],
      gmMessageGenerator,
      gmSender,
    );
    expect(result.allReceived).toBe(true);
  }); // Increase timeout if needed

  it("test elon sending gm to fabri", async () => {
    const dmConvo = await personas["elon"].client?.conversations.newDm(
      personas["fabri"].client?.accountAddress as `0x${string}`,
    );
    if (!dmConvo) {
      throw new Error("DM conversation not found");
    }
    const result = await verifyStream(
      dmConvo,
      [personas["fabri"]],
      gmMessageGenerator,
      gmSender,
    );
    expect(result.allReceived).toBe(true);
  }); // Increase timeout if needed

  it("test bob sending gm to joe", async () => {
    const dmConvo = await personas["bob"].client?.conversations.newDm(
      personas["joe"].client?.accountAddress as `0x${string}`,
    );
    if (!dmConvo) {
      throw new Error("DM conversation not found");
    }
    const result = await verifyStream(
      dmConvo,
      [personas["joe"]],
      gmMessageGenerator,
      gmSender,
    );
    expect(result.allReceived).toBe(true);
  });

  it("should receive a group message in all streams", async () => {
    const newGroup = await personas["bob"].client!.conversations.newGroup(
      Object.values(personas).map(
        (p) => p.client?.accountAddress as `0x${string}`,
      ),
    );
    const members = await newGroup.members();
    for (const member of members) {
      const worker = Object.values(personas).find(
        (w) => w.client!.inboxId === member.inboxId,
      );
      console.log(
        "name:",
        worker?.name,
        "installations:",
        member.installationIds.length,
      );
    }
    const result = await verifyStream(
      newGroup,
      [personas["bob"], personas["joe"], personas["elon"], personas["fabri"]],
      gmMessageGenerator,
      gmSender,
    );
    expect(result.allReceived).toBe(true);
  });
});
