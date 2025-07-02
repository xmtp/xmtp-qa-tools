import { verifyMetadataStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "metadata";

describe(testName, async () => {
  let group: Group;

  const workers = await getWorkers([
    "henry",
    "ivy",
    "jack",
    "karen",
    "randomguy",
    "larry",
    "mary",
    "nancy",
    "oscar",
  ]);

  setupTestLifecycle({});

  beforeAll(async () => {
    group = (await workers
      .get("henry")!
      .client.conversations.newGroup([
        workers.get("nancy")!.client.inboxId,
        workers.get("oscar")!.client.inboxId,
        workers.get("jack")!.client.inboxId,
      ])) as Group;
    console.log("group", group.id);
  });

  it("should stream group metadata updates when group name or description changes", async () => {
    const verifyResult = await verifyMetadataStream(group, [
      workers.get("oscar")!,
    ]);
    expect(verifyResult.allReceived).toBe(true);
  });

  it("should successfully add new members to existing group and verify member count", async () => {
    await group.addMembers([workers.get("randomguy")!.client.inboxId]);
    const members = await group.members();
    expect(members.length).toBe(5);
  });

  it("should successfully remove members from group and verify updated member count", async () => {
    await group.removeMembers([workers.get("randomguy")!.client.inboxId]);
    const members = await group.members();
    expect(members.length).toBe(4);
  });
});
