import { createAgent } from "@agents/factory";
import type { AgentManager } from "@agents/manager";
import { closeEnv, loadEnv } from "@helpers/client";
import { sendTestResults } from "@helpers/datadog";
import { exportTestResults, logError } from "@helpers/tests";
import { type Conversation } from "@helpers/types";
import { verifyStream } from "@helpers/verify";
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
  let agents: AgentManager;
  let hasFailures: boolean = false;
  let start: number;

  beforeAll(async () => {
    try {
      agents = await createAgent(
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
      expect(agents).toBeDefined();
      expect(agents.getLength()).toBe(9);
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
      exportTestResults(expect, agents, start);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  afterAll(async () => {
    try {
      sendTestResults(hasFailures ? "failure" : "success", testName);
      await closeEnv(testName, agents);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("createDM: should measure creating a DM", async () => {
    try {
      convo = await agents
        .get("henry")!
        .client.conversations.newDm(agents.get("randomguy")!.client.inboxId);

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
        `[${agents.get("henry")?.name}] Creating DM with ${agents.get("randomguy")?.name} at ${agents.get("randomguy")?.client.inboxId}`,
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
        agents.get("randomguy")!,
      ]);

      expect(verifyResult.messages.length).toEqual(1);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });
});
