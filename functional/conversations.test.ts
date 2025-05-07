import { loadEnv } from "@helpers/client";
import { verifyConversationStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "conversations";
loadEnv(testName);

describe(testName, async () => {
  let workers: WorkerManager;
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
    "conversation",
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

  it("detects new group conversation creation with three participants", async () => {
    const sender = workers.get("henry")!;
    const participants = [workers.get("nancy")!, workers.get("oscar")!];

    await verifyConversationStream(sender, participants);
  });

  it("detects new group conversation with all available workers", async () => {
    const sender = workers.get("henry")!;
    const participants = [
      workers.get("nancy")!,
      workers.get("oscar")!,
      workers.get("jack")!,
      workers.get("ivy")!,
    ];

    await verifyConversationStream(sender, participants);
  });
});
