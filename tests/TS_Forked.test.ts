import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  verifyMetadataUpdates,
  verifyNotForked,
  type Conversation,
} from "../helpers/verify";
import {
  getWorkers,
  WorkerNames,
  type Persona,
} from "../helpers/workers/creator";

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
  let participants: Persona[] = [];
  let random: Persona;
  let bella: Persona;
  let dave: Persona;
  let elon: Persona;
  let diana: Persona;
  let group: Conversation;

  beforeAll(async () => {
    console.time("createLogger");
    const logger = createLogger(testName);
    console.timeEnd("createLogger");

    console.time("overrideConsole");
    overrideConsole(logger);
    console.timeEnd("overrideConsole");

    console.time("getWorkers");
    participants = await getWorkers(
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
    [bella, dave, elon, diana, random] = participants;
    console.timeEnd("getWorkers");
  });

  afterAll(async () => {
    console.time("afterAll");
    flushLogger(testName);
    await Promise.all(
      participants.map(async (p) => {
        await p.worker?.terminate();
      }),
    );
    console.timeEnd("afterAll");
  });

  it("should create a group", async () => {
    console.time("newGroup");
    group = await bella.client!.conversations.newGroup([
      dave.client!.accountAddress,
      elon.client!.accountAddress,
      diana.client!.accountAddress,
      random.client!.accountAddress,
    ]);
    expect(group).toBeDefined();
    expect(group.id).toBeDefined();
    console.timeEnd("newGroup");
  });

  it("should message a gm", async () => {
    expect(await verifyNotForked(group, participants)).toBe(true);
  });

  it("should handle group name updates", async () => {
    console.time("updateName");
    const groupName =
      "New Group Name" + Math.random().toString(36).substring(2, 15);
    await verifyMetadataUpdates(
      () => group.updateName(groupName),
      participants,
      { fieldName: "group_name", newValue: groupName },
    );
    console.timeEnd("updateName");

    expect(await verifyNotForked(group, participants)).toBe(true);
  });

  it("should handle adding new  members", async () => {
    console.time("addMembers");
    await group.addMembers([random.client?.accountAddress as `0x${string}`]);
    console.timeEnd("addMembers");

    participants.push(random);

    expect(await verifyNotForked(group, participants)).toBe(true);
  });

  it("should handle removing members", async () => {
    console.time("removeMembers");
    await group.removeMembers([random.client?.accountAddress as `0x${string}`]);
    console.timeEnd("removeMembers");

    participants = participants.filter((p) => p !== random);

    console.time("verifyMetadataUpdates");
    const groupName =
      "New Group Name" + Math.random().toString(36).substring(2, 15);
    await verifyMetadataUpdates(
      () => group.updateName(groupName),
      participants,
      { fieldName: "group_name", newValue: groupName },
    );
    console.timeEnd("verifyMetadataUpdates");

    expect(await verifyNotForked(group, participants)).toBe(true);
  });
});
