import { closeEnv, loadEnv } from "@helpers/client";
import type { NestedPersonas } from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "bug_installation";
loadEnv(testName);

describe(testName, () => {
  let personas: NestedPersonas;

  beforeAll(async () => {
    personas = await getWorkers(["bob", "alice", "joe"], testName, "none");
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  it("inboxState", async () => {
    for (const persona of personas.getPersonas()) {
      const inboxState = await persona.client!.inboxState();
      console.log("Installations", inboxState.installations.length);
    }
  });

  it("should create a group with bob and alice", async () => {
    const group = await personas
      .get("bob")!
      .client!.conversations.newGroupByInboxIds([
        personas.get("alice")!.client!.inboxId,
      ]);
    expect(group.id).toBeDefined();
  });

  it("should create a group with bob and alice", async () => {
    const group = await personas
      .get("bob")!
      .client!.conversations.newGroupByInboxIds([
        personas.get("joe")!.client!.inboxId,
      ]);
    expect(group.id).toBeDefined();
  });
  it("joe with alice", async () => {
    const group = await personas
      .get("joe")!
      .client!.conversations.newGroupByInboxIds([
        personas.get("alice")!.client!.inboxId,
      ]);
    expect(group.id).toBeDefined();
  });
  // it("fabri creates a grop with all", async () => {
  //   const group = await personas[
  //     "fabri"
  //   ].client!.conversations.newGroupByInboxIds([
  //     personas["bob"].client!.inboxId,
  //     personas["alice"].client!.inboxId,
  //     personas["joe"].client!.inboxId,
  //   ]);
  //   expect(group.id).toBeDefined();
  // });
});
