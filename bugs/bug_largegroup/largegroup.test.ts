import { closeEnv, loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Conversation } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "largegroup";
loadEnv(testName);
describe(testName, () => {
  let workers: WorkerManager;
  let group: Conversation;

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
  });

  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it(`createGroup-450: should create a large group of 450 participants 450`, async () => {
    const sliced = generatedInboxes.slice(0, 450);
    group = await workers
      .get("henry")!
      .client.conversations.newGroup(sliced.map((inbox) => inbox.inboxId));
    expect(group.id).toBeDefined();
  });
  it(`createGroup-500: should create a large group of 500 participants 500`, async () => {
    const sliced = generatedInboxes.slice(0, 500);
    group = await workers
      .get("henry")!
      .client.conversations.newGroup(sliced.map((inbox) => inbox.inboxId));
    expect(group.id).toBeDefined();
  });
});
