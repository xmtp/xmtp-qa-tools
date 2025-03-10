import { closeEnv, loadEnv } from "@helpers/client";
import { sendPerformanceMetric, sendTestResults } from "@helpers/datadog";
import { exportTestResults, logError } from "@helpers/tests";
import { type Conversation, type Persona } from "@helpers/types";
import { verifyStream } from "@helpers/verify";
import { getWorkers } from "@helpers/workers/factory";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

const testName = "ts_dms";

describe(testName, () => {
  loadEnv(testName);
  let convo: Conversation;
  let personas: Record<string, Persona>;
  let hasFailures: boolean = false;
  let start: number;

  beforeAll(async () => {
    try {
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
      expect(personas).toBeDefined();
      expect(Object.values(personas).length).toBe(9);
    } catch (e) {
      hasFailures = logError(e, expect);
    }
  });

  beforeEach(() => {
    const testName = expect.getState().currentTestName;
    start = performance.now();
    console.time(testName);
  });

  afterEach(function () {
    try {
      exportTestResults(expect, personas, start);
    } catch (e) {
      hasFailures = logError(e, expect);
    }
  });

  afterAll(async () => {
    try {
      sendTestResults(hasFailures ? "failure" : "success", testName);
      await closeEnv(testName, personas);
    } catch (e) {
      hasFailures = logError(e, expect);
    }
  });

  it("createDM: should measure creating a DM", async () => {
    try {
      convo = await personas.henry.client!.conversations.newDm(
        personas.randomguy.client!.accountAddress,
      );

      expect(convo).toBeDefined();
      expect(convo.id).toBeDefined();
    } catch (e) {
      hasFailures = logError(e, expect);
    }
  });

  it("sendGM: should measure sending a gm", async () => {
    try {
      const message = "gm-" + Math.random().toString(36).substring(2, 15);

      console.log(
        `[${personas.henry.name}] Creating DM with ${personas.randomguy.name} at ${personas.randomguy.client?.accountAddress}`,
      );

      const dmId = await convo.send(message);

      expect(dmId).toBeDefined();
    } catch (e) {
      hasFailures = logError(e, expect);
    }
  });

  it("receiveGM: should measure receiving a gm", async () => {
    try {
      const verifyResult = await verifyStream(convo, [personas.randomguy]);

      expect(verifyResult.messages.length).toEqual(1);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect);
    }
  });
});
