import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { XmtpPlaywright } from "@helpers/playwright";
import { setupTestLifecycle } from "@helpers/vitest";
import { beforeAll, describe, expect, it } from "vitest";
import productionAgents from "./production.json";

// Define the types for the agents
interface Agent {
  name: string;
  address: string;
  sendMessage: string;
  expectedMessage: string[];
}

// Type assertion for imported JSON
const typedAgents = productionAgents as Agent[];
const testName = "TS_Agents";
loadEnv(testName);

describe(testName, () => {
  let xmtpTester: XmtpPlaywright;
  beforeAll(async () => {
    xmtpTester = new XmtpPlaywright({
      headless: true,
      env: "production",
      defaultUser: true,
    });
    await xmtpTester.startPage();
  });

  setupTestLifecycle({
    expect,
  });

  // For local testing, test all agents on their supported networks
  for (const agent of typedAgents) {
    it(`test ${agent.name}:${agent.address} on production`, async () => {
      try {
        console.debug(`Testing ${agent.name} with address ${agent.address} `);
        await xmtpTester.newDmFromUI(agent.address);
        await xmtpTester.sendMessage(agent.sendMessage);
        const result = await xmtpTester.waitForResponse(agent.expectedMessage);
        expect(result).toBe(true);
      } catch (error) {
        await xmtpTester.takeSnapshot(`${agent.name}-${agent.address}`);
        logError(error, `${agent.name}-${agent.address}`);
        throw error;
      }
    });
  }
});
