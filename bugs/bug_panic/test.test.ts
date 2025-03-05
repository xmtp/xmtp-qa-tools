import { closeEnv, loadEnv } from "@helpers/client";
import type { Persona } from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "bug_panic";
loadEnv(testName);

describe(testName, () => {
  let personas: Record<string, Persona>;

  beforeAll(async () => {
    personas = await getWorkers(20, testName);
  });
  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  it("createGroupByInboxIds: should measure creating a group with inbox ids", async () => {
    const groupByInboxIds =
      await personas.bob.client!.conversations.newGroupByInboxIds(
        Object.values(personas).map((persona) => persona.client!.inboxId),
      );

    expect(groupByInboxIds.id).toBeDefined();
  });
});
