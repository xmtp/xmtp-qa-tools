import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

describe("groups", async () => {
  setupTestLifecycle({});
  const workers = await getWorkers(
    [
      "henry",
      "ivy",
      "jack",
      "karen",
      "randomguy",
      "randomguy2",
      "larry",
      "mary",
      "nancy",
      "oscar",
    ],
    { useVersions: true },
  );

  it("should create a new group with all workers", async () => {
    const group = await workers.createGroupBetweenAll("Test Group");
    expect(group).toBeDefined();
    expect(group.id).toBeDefined();
  });

  it("should send a message in the group", async () => {
    const group = await workers.createGroupBetweenAll("Test Group 2");
    const messageId = await group.send("Hello, group!");
    expect(messageId).toBeDefined();
  });

  it("should update group name", async () => {
    const group = await workers.createGroupBetweenAll("Old Name");
    await group.updateName("New Name");
    expect(group.name).toBe("New Name");
  });

  it("should receive and verify message delivery in group", async () => {
    const group = await workers.createGroupBetweenAll("Test Group 3");

    const verifyResult = await verifyMessageStream(
      group,
      workers.getAllButCreator(),
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("should list all members", async () => {
    const group = await workers.createGroupBetweenAll("Test Group 4");
    const members = await group.members();
    expect(members).toBeDefined();
    expect(members.length).toBeGreaterThan(1);
  });

  it("should handle group metadata updates", async () => {
    const group = await workers.createGroupBetweenAll("Metadata Test");

    await group.updateDescription("Test description");
    expect(group.description).toBe("Test description");

    await group.updateName("Updated Name");
    expect(group.name).toBe("Updated Name");
  });
});
