import { closeEnv, loadEnv } from "@helpers/client";
import { type WorkerManager } from "@helpers/types";
import { verifyConversationStream } from "@helpers/verify";
import { getWorkers } from "@workers/manager";
import { afterAll, beforeAll, describe, it } from "vitest";

const testName = "conversations";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;

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
      "conversation",
    );
  });

  afterAll(async () => {
    await closeEnv(testName, workers);
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
