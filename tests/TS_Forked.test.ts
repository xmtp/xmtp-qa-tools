import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { WorkerNames, type Conversation, type Persona } from "../helpers/types";
import { getWorkers } from "../helpers/workers/creator";
import { verifyStream } from "../helpers/workers/stream";

const env = "dev";
const testName = "TS_Forked_" + env;

/*
TODO
- Stress groups (200 users.installations, who sends, who was added last)
- Addying my self to a group? stream doesnt work
- After running a couple of times

thread 'tokio-runtime-worker' panicked at /Users/runner/work/libxmtp/libxmtp/xmtp_mls/src/subscriptions/stream_conversations.rs:333:78:
`async fn` resumed after completion
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

*/

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
    const logger = createLogger(testName);
    console.timeEnd("createLogger");

    console.time("overrideConsole");
    overrideConsole(logger);
    console.timeEnd("overrideConsole");

    console.time("getWorkers");
    personas = await getWorkers(
      [
        WorkerNames.BELLA,
        WorkerNames.DAVE,
        WorkerNames.ELON,
        WorkerNames.DIANA,
        "random",
      ],
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
    group = await personas[WorkerNames.BELLA].client!.conversations.newGroup([
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
      [personas[WorkerNames.ELON]],
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
      [personas["elon"]],
      nameUpdateGenerator,
      nameUpdater,
      "group_updated",
    );
    expect(result.allReceived).toBe(true);
    console.timeEnd("updateName");

    const resultDm = await verifyStream(
      group,
      [personas["elon"]],
      gmMessageGenerator,
      gmSender,
    );
    expect(resultDm.allReceived).toBe(true);
  });

  it("should handle adding new  members", async () => {
    console.time("addMembers");
    await group.addMembers([
      personas["random"].client?.accountAddress as `0x${string}`,
    ]);
    console.timeEnd("addMembers");

    const result = await verifyStream(
      group,
      [personas["elon"]],
      gmMessageGenerator,
      gmSender,
    );
    expect(result.allReceived).toBe(true);
  });

  it("should handle removing members", async () => {
    console.time("removeMembers");
    await group.removeMembers([
      personas["random"].client?.accountAddress as `0x${string}`,
    ]);
    console.timeEnd("removeMembers");

    console.time("verifyStream");
    const result = await verifyStream(
      group,
      Object.values(personas).filter((p) => p !== personas["random"]),
      gmMessageGenerator,
      gmSender,
    );
    console.timeEnd("verifyStream");
    expect(result.allReceived).toBe(true);
  });
});
