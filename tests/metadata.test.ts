import { closeEnv, loadEnv } from "@helpers/client";
import { type Group, type WorkerManager } from "@helpers/types";
import { verifyStream } from "@helpers/verify";
import { getWorkers } from "@workers/manager";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "metadata";
loadEnv(testName);

describe(testName, () => {
  let group: Group;
  let workers: WorkerManager;
  beforeAll(async () => {
    workers = await getWorkers(
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

    console.time("create group");
    group = await workers
      .get("henry")!
      .client.conversations.newGroup([
        workers.get("nancy")?.client?.inboxId ?? "",
        workers.get("oscar")?.client?.inboxId ?? "",
        workers.get("jack")?.client?.inboxId ?? "",
      ]);
    console.log("group", group.id);
    console.timeEnd("create group");
  });

  afterAll(async () => {
    await closeEnv(testName, workers);
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
