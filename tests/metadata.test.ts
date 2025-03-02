import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeEnv, loadEnv } from "../helpers/client";
import { type Conversation, type Persona } from "../helpers/types";
import { verifyStream } from "../helpers/verify";
import { getWorkers } from "../helpers/workers/factory";

const testName = "metadata";
await loadEnv(testName);

describe(testName, () => {
  let bobsGroup: Conversation;
  let personas: Record<string, Persona>;
  beforeAll(async () => {
    personas = await getWorkers(
      ["bob", "joe", "elon", "fabri", "alice"],
      testName,
    );

    console.time("create group");
    bobsGroup = await personas.bob.client!.conversations.newGroup([
      personas.bob.client?.accountAddress as `0x${string}`,
      personas.joe.client?.accountAddress as `0x${string}`,
      personas.elon.client?.accountAddress as `0x${string}`,
    ]);
    console.log("Bob's group", bobsGroup.id);
    console.timeEnd("create group");
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  it("TC_ReceiveMetadata: should update group name", async () => {
    console.time("update group name");

    const verifyResult = await verifyStream(
      bobsGroup,
      [personas.joe],
      "group_updated",
    );
    expect(verifyResult.allReceived).toBe(true);
    console.timeEnd("update group name");
  });

  it("TC_AddMembers: should measure adding a participant to a group", async () => {
    console.time("add members");
    await bobsGroup.addMembers([
      personas.fabri.client?.accountAddress as `0x${string}`,
    ]);
    const members = await bobsGroup.members();
    console.timeEnd("add members");
    expect(members.length).toBe(4);
  });

  it("TC_RemoveMembers: should remove a participant from a group", async () => {
    console.time("remove members");
    await bobsGroup.removeMembers([
      personas.fabri.client?.accountAddress as `0x${string}`,
    ]);
    const members = await bobsGroup.members();
    console.timeEnd("remove members");
    expect(members.length).toBe(3);
  });
});
