import { closeEnv, loadEnv } from "@helpers/client";
import { sendPerformanceResult, sendTestResults } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import { verifyStreamAll } from "@helpers/streams";
import {
  createAndSendDms,
  createAndSendInGroup,
  createLargeGroup,
  createLargeGroups,
  performGroupOperations,
  sendWorkerMessagesToGroup,
  TEST_CONFIGS,
  testMessageStreaming,
} from "@helpers/stress";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { Dm, Group } from "@xmtp/node-sdk";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { C } from "vitest/dist/chunks/reporters.d.CfRkRKN2.js";

const testName = "stress";
loadEnv(testName);

const receiverInboxId =
  "ac9feb1384a9092333db4d17c6981743a53277c24c57ed6f12f05bd78a81be30";
// Choose which test size to run
const testSize = process.env.STRESS_SIZE || "small";
const config = TEST_CONFIGS[testSize];

console.log(`Running ${testSize} stress test with configuration:`, config);

describe(testName, () => {
  let workers: WorkerManager;
  let start: number;
  let hasFailures: boolean = false;

  beforeAll(async () => {
    try {
      workers = await getWorkers(config.workerCount, testName, "message", "gm");
      expect(workers).toBeDefined();
      expect(workers.getWorkers().length).toBe(config.workerCount);
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

  // Create a DM between two workers
  it("createAndSendDms: should create DMs and send messages", async () => {
    try {
      const dm = await createAndSendDms(
        workers,
        receiverInboxId,
        config.messageCount,
      );

      expect(dm).toBeTruthy();
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  // Create a small group with worker members
  it("createAndSendInGroup: should create a group and send messages", async () => {
    try {
      const group = await createAndSendInGroup(
        workers,
        config.groupCount,
        receiverInboxId,
      );

      expect(group).toBeTruthy();
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  // // Create a large group
  it("createLargeGroup: should create a large group with many members", async () => {
    try {
      // Create large groups
      const result = await createLargeGroups(config, workers, receiverInboxId);

      expect(result).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });
});
