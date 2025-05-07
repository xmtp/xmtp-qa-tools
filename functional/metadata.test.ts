import { loadEnv } from "@helpers/client";
import { verifyStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "metadata";
loadEnv(testName);

describe(testName, async () => {
  let group: Group;
  let hasFailures: boolean = false;
  let start: number;
  let testStart: number;
  const workers = await getWorkers(
    [
      "henry",
      "ivy",
      "jack",
      "karen",
      "randomguy",
      "larry",
      "mary",
      "nancy",
      "oscar",
    ],
    testName,
  );

  setupTestLifecycle({
    expect,
    workers,
    testName,
    hasFailuresRef: hasFailures,
    getStart: () => start,
    setStart: (v) => {
      start = v;
    },
    getTestStart: () => testStart,
    setTestStart: (v) => {
      testStart = v;
    },
  });

  beforeAll(async () => {
    console.time("create group");
    group = await workers
      .get("henry")!
      .client.conversations.newGroup([
        workers.get("nancy")!.client.inboxId,
        workers.get("oscar")!.client.inboxId,
        workers.get("jack")!.client.inboxId,
      ]);
    console.log("group", group.id);
    console.timeEnd("create group");
  });

  it("TC_ReceiveMetadata: should update group name", async () => {
    console.time("update group name");

    const verifyResult = await verifyStream(
      group,
      [workers.get("oscar")!],
      "group_updated",
    );
    expect(verifyResult.allReceived).toBe(true);
    console.timeEnd("update group name");
  });

  it("TC_AddMembers: should measure adding a participant to a group", async () => {
    console.time("add members");
    await group.addMembers([workers.get("randomguy")!.client.inboxId]);
    const members = await group.members();
    console.timeEnd("add members");
    expect(members.length).toBe(5);
  });

  it("TC_RemoveMembers: should remove a participant from a group", async () => {
    console.time("remove members");
    await group.removeMembers([workers.get("randomguy")!.client.inboxId]);
    const members = await group.members();
    console.timeEnd("remove members");
    expect(members.length).toBe(4);
  });
});
