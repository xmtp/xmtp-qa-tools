import { closeEnv, loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { type Conversation, type NestedPersonas } from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "largegroup";
loadEnv(testName);
describe(testName, () => {
  let personas: NestedPersonas;
  let group: Conversation;

  beforeAll(async () => {
    personas = await getWorkers(
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
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  it(`createGroup-450: should create a large group of 450 participants 450`, async () => {
    const sliced = generatedInboxes.slice(0, 450);
    group = await personas
      .get("henry")!
      .client!.conversations.newGroup(sliced.map((inbox) => inbox.inboxId));
    expect(group.id).toBeDefined();
  });
  it(`createGroup-500: should create a large group of 500 participants 500`, async () => {
    const sliced = generatedInboxes.slice(0, 500);
    group = await personas
      .get("henry")!
      .client!.conversations.newGroup(sliced.map((inbox) => inbox.inboxId));
    expect(group.id).toBeDefined();
  });
});
