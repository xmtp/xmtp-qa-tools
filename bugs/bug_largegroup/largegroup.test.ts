import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "largegroup";
loadEnv(testName);
describe(testName, async () => {
  let workers: WorkerManager;
  let group: Conversation;
  let hasFailures: boolean = false;
  let start: number;
  let testStart: number;
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
  setupTestLifecycle({
    expect,
    workers,
    testName,
    hasFailuresRef: hasFailures,
    getStart: () => start,
    setStart: (v) => {
      start = v;
    },
    getTestStart: () => testStart,
    setTestStart: (v) => {
      testStart = v;
    },
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
