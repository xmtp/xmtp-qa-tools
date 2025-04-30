import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { XmtpPlaywright } from "@helpers/playwright";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";
import liveAgents from "./agents.json";

const testName = "ts_live_agents";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  let targetAgent: { name: string; address: string };

  beforeAll(async () => {
    try {
      // Set the target agent based on environment variables or use the first one as default
      if (process.env.TARGET_AGENT_NAME && process.env.TARGET_AGENT_ADDRESS) {
        targetAgent = {
          name: process.env.TARGET_AGENT_NAME,
          address: process.env.TARGET_AGENT_ADDRESS,
        };
      } else {
        // If no target is specified, run against the first agent in the list
        targetAgent = liveAgents[0];
      }

      console.log(
        `Testing agent: ${targetAgent.name} (${targetAgent.address})`,
      );

      workers = await getWorkers(
        ["bob"],
        testName,
        "message",
        "none",
        "production",
      );
      expect(workers).toBeDefined();
      expect(workers.getWorkers().length).toBe(1);
    } catch (e) {
      logError(e, expect);
      throw e;
    }
  });

  it(`should respond to message from ${process.env.TARGET_AGENT_NAME || "agent"}`, async () => {
    try {
      const xmtpTester = new XmtpPlaywright(false, "production");
      const result = await xmtpTester.newDmWithDeeplink(
        targetAgent.address,
        "hey",
      );
      expect(result).toBe(true);
    } catch (e) {
      logError(e, expect);
      throw e;
    }
  });
});
