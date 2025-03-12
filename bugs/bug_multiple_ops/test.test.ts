import { closeEnv, loadEnv } from "@helpers/client";
import {
  type Conversation,
  type Group,
  type NestedPersonas,
} from "@helpers/types";
import { verifyStreamAll } from "@helpers/verify";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "bug_multiple_ops";
loadEnv(testName);

describe(testName, () => {
  let personas: NestedPersonas;
  let group: Conversation;

  beforeAll(async () => {
    personas = await getWorkers(
      ["bella", "dave", "elon", "diana", "alice", "bob"],
      testName,
    );
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  it("should create a group and establish baseline communication", async () => {
    // Create initial group with a few members
    group = await personas
      .get("bella")!
      .client!.conversations.newGroupByInboxIds([
        personas.get("dave")?.client?.inboxId as `0x${string}`,
        personas.get("elon")?.client?.inboxId as `0x${string}`,
      ]);

    expect(group).toBeDefined();
    expect(group.id).toBeDefined();

    // Send initial messages to establish that communication works
    await group.send("Initial message in epoch 0");

    const result = await verifyStreamAll(group, personas);
    expect(result.allReceived).toBe(true);
  });

  it("should force an epoch transition by adding members", async () => {
    // Adding members should trigger an epoch transition in MLS
    console.log("Adding members to trigger epoch transition");
    await (group as Group).addMembers([
      personas.get("diana")?.client?.accountAddress as `0x${string}`,
    ]);
    // Verify all members including new ones can receive messages
    const result = await verifyStreamAll(group, personas);
    expect(result.allReceived).toBe(true);
  });
});
