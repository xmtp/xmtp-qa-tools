import { sendPerformanceResult, sendTestResults } from "@datadog/git add . && git commit -m "fix datadog summary"  && git push;";
import { closeEnv, loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { type Conversation, type WorkerManager } from "@helpers/types";
import { verifyStream } from "@helpers/verify";
import { getWorkers } from "@workers/manager";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

const testName = "dms";

describe(testName, () => {
  loadEnv(testName);
  let convo: Conversation;
  let workers: WorkerManager;
  let hasFailures: boolean = false;
  let start: number;

  beforeAll(async () => {
    try {
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
      expect(workers).toBeDefined();
      expect(workers.getLength()).toBe(9);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  beforeEach(() => {
    const testName = expect.getState().currentTestName;
    start = performance.now();
    console.time(testName);
  });

  afterEach(function () {
    try {
      sendPerformanceResult(expect, workers, start);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  afterAll(async () => {
    try {
      sendTestResults(hasFailures, testName);
      await closeEnv(testName, workers);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("createDM: should measure creating a DM", async () => {
    try {
      convo = await workers
        .get("henry")!
        .client.conversations.newDm(workers.get("randomguy")!.client.inboxId);

      expect(convo).toBeDefined();
      expect(convo.id).toBeDefined();
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("sendGM: should measure sending a gm", async () => {
    try {
      const message = "gm-" + Math.random().toString(36).substring(2, 15);

      console.log(
        `[${workers.get("henry")?.name}] Creating DM with ${workers.get("randomguy")?.name} at ${workers.get("randomguy")?.client.inboxId}`,
      );

      const dmId = await convo.send(message);

      expect(dmId).toBeDefined();
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("receiveGM: should measure receiving a gm", async () => {
    try {
      const verifyResult = await verifyStream(convo, [
        workers.get("randomguy")!,
      ]);

      expect(verifyResult.messages.length).toEqual(1);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });
});
