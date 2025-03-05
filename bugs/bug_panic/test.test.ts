import { closeEnv, loadEnv } from "@helpers/client";
import type { Persona } from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "bug_panic";
loadEnv(testName);

describe(testName, () => {
  let personas: Record<string, Persona>;

  it("createGroupByInboxIds: should measure creating a group with inbox ids", async () => {
    personas = await getWorkers(30, testName);
    const workerArray = Object.values(personas);
    const groupByInboxIds =
      await personas.bob.client!.conversations.newGroupByInboxIds(
        Object.values(personas).map((persona) => persona.client!.inboxId),
      );
    for (const worker of workerArray) {
      await worker.worker?.terminate();
    }
    expect(groupByInboxIds.id).toBeDefined();
  });
});
