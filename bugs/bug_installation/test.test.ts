import { closeEnv, loadEnv } from "@helpers/client";
import type { Persona } from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "bug_cointoss";
loadEnv(testName);

describe(testName, () => {
  let personas: Record<string, Persona>;

  beforeAll(async () => {
    personas = await getWorkers(["bob", "alice", "joe"], testName, "none");
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  it("inboxState", async () => {
    for (const persona of Object.values(personas)) {
      const inboxState = await persona.client!.inboxState();
      console.log("Installations", inboxState.installations.length);
    }
  });

  it("should create a group with bob and alice", async () => {
    const group = await personas[
      "bob"
    ].client!.conversations.newGroupByInboxIds([
      personas["alice"].client!.inboxId,
    ]);
    expect(group.id).toBeDefined();
  });

  it("should create a group with bob and alice", async () => {
    const group = await personas[
      "bob"
    ].client!.conversations.newGroupByInboxIds([
      personas["joe"].client!.inboxId,
    ]);
    expect(group.id).toBeDefined();
  });
  it("joe with alice", async () => {
    const group = await personas[
      "joe"
    ].client!.conversations.newGroupByInboxIds([
      personas["alice"].client!.inboxId,
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
