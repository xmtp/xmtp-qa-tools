import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { WorkerNames, type Conversation, type Persona } from "../helpers/types";
import { verifyStream } from "../helpers/verify";
import { getWorkers } from "../helpers/workers/factory";

const env = "dev";
const testName = "TS_Forked_" + env;

dotenv.config();

describe(testName, () => {
  let personas: Record<string, Persona>;
  let group: Conversation;
  let gmMessageGenerator: (i: number, suffix: string) => Promise<string>;
  let gmSender: (convo: Conversation, message: string) => Promise<void>;

  beforeAll(async () => {
    gmMessageGenerator = async (i: number, suffix: string) => {
      return `gm-${i + 1}-${suffix}`;
    };
    gmSender = async (convo: Conversation, message: string) => {
      await convo.send(message);
    };
    console.time("createLogger");
    const logger = await createLogger(testName);
    console.timeEnd("createLogger");

    console.time("overrideConsole");
    overrideConsole(logger);
    console.timeEnd("overrideConsole");

    console.time("getWorkers");
    personas = await getWorkers(
      ["bella", "dave", "elon", "diana", "random"],
      env,
      testName,
    );
    console.timeEnd("getWorkers");
  });

  afterAll(async () => {
    await flushLogger(testName);
    await Promise.all(
      Object.values(personas).map(async (p) => {
        await p.worker?.terminate();
      }),
    );
    console.timeEnd("afterAll");
  });

  it("should create a group", async () => {
    console.time("newGroup");
    group = await personas.bella.client!.conversations.newGroup([
      ...Object.values(personas).map(
        (p) => p.client?.accountAddress as `0x${string}`,
      ),
    ]);
    expect(group).toBeDefined();
    expect(group.id).toBeDefined();
    console.timeEnd("newGroup");
  });

  it("should message a gm", async () => {
    const result = await verifyStream(
      group,
      [personas.elon],
      gmMessageGenerator,
      gmSender,
    );
    expect(result.allReceived).toBe(true);
  });

  it("should handle group name updates", async () => {
    console.time("updateName");
    const nameUpdateGenerator = async (i: number, suffix: string) => {
      return `New name-${i + 1}-${suffix}`;
    };

    const nameUpdater = async (group: Conversation, newName: string) => {
      await group.updateName(newName);
    };

    const result = await verifyStream(
      group,
      [personas.elon],
      nameUpdateGenerator,
      nameUpdater,
      "group_updated",
    );
    expect(result.allReceived).toBe(true);
    console.timeEnd("updateName");

    const resultDm = await verifyStream(
      group,
      [personas.elon],
      gmMessageGenerator,
      gmSender,
    );
    expect(resultDm.allReceived).toBe(true);
  });

  it("should handle adding new  members", async () => {
    console.time("addMembers");
    await group.addMembers([
      personas.random.client?.accountAddress as `0x${string}`,
    ]);
    console.timeEnd("addMembers");

    const result = await verifyStream(
      group,
      [personas.elon],
      gmMessageGenerator,
      gmSender,
    );
    expect(result.allReceived).toBe(true);
  });

  it("should handle removing members", async () => {
    console.time("removeMembers");
    await group.removeMembers([
      personas.random.client?.accountAddress as `0x${string}`,
    ]);
    console.timeEnd("removeMembers");

    console.time("verifyStream");
    const result = await verifyStream(
      group,
      Object.values(personas).filter((p) => p !== personas.random),
      gmMessageGenerator,
      gmSender,
    );
    console.timeEnd("verifyStream");
    expect(result.allReceived).toBe(true);
  });
});
