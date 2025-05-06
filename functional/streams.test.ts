import { closeEnv, loadEnv } from "@helpers/client";
import { sendPerformanceResult, sendTestResults } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import { verifyStream, verifyStreamAll } from "@helpers/streams";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

const testName = "streams";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  let hasFailures: boolean = false;
  let start: number | undefined;
  let testStart: number;

  beforeAll(async () => {
    try {
      workers = await getWorkers(
        ["henry", "bob", "alice", "dave", "randomguy"],
        testName,
      );
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  beforeEach(() => {
    const testName = expect.getState().currentTestName;
    console.time(testName);
    testStart = performance.now();
    start = undefined;
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

  afterEach(function () {
    try {
      sendPerformanceResult(expect, workers, start, testStart);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("receiveGM: should measure receiving a gm", async () => {
    try {
      const convo = await workers
        .get("henry")!
        .client.conversations.newDm(workers.get("randomguy")!.client.inboxId);

      const verifyResult = await verifyStream(
        convo,
        [workers.get("randomguy")!],
        "text",
        1,
        undefined,
        undefined,
        () => {
          console.log("DM message sent, starting timer now");
          start = performance.now();
        },
      );

      expect(verifyResult.messages.length).toEqual(1);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it(`receiveGroupMessage: should create a group and measure all streams`, async () => {
    try {
      const convo = await workers
        .get("henry")!
        .client.conversations.newGroup([
          workers.get("randomguy")!.client.inboxId,
          workers.get("bob")!.client.inboxId,
          workers.get("alice")!.client.inboxId,
          workers.get("dave")!.client.inboxId,
        ]);

      const verifyResult = await verifyStreamAll(convo, workers, 1, () => {
        console.log("Group message sent, starting timer now");
        start = performance.now();
      });

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });
});
