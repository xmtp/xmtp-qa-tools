import { closeEnv, loadEnv } from "@helpers/client";
import { sendTestResults } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import { XmtpPlaywright } from "@helpers/playwright";
import type { WorkerManager } from "@workers/manager";
import type { XmtpEnv } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import agentHealth from "./agents.json";

// Define the types for the agents
interface Agent {
  name: string;
  address: string;
  networks: string[];
  sendMessage: string;
  expectedMessage: string;
}

// Type assertion for imported JSON
const typedAgents = agentHealth as Agent[];
const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const testName = "ts_agenthealth";
loadEnv(testName);

describe(testName, () => {
  let hasFailures = false;
  let workers: WorkerManager | undefined;
  afterAll(async () => {
    try {
      sendTestResults(hasFailures, testName);
      await closeEnv(testName, workers);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  // For local testing, test all agents on their supported networks
  for (const agent of typedAgents) {
    for (const network of agent.networks) {
      it(`${agent.name} ${network}`, async () => {
        try {
          console.log(`Testing ${agent.name} on ${network}`);
          const xmtpTester = new XmtpPlaywright(true, network as XmtpEnv);
          const result = await xmtpTester.newDmWithDeeplink(
            agent.address,
            agent.sendMessage,
            agent.expectedMessage,
          );
          expect(result).toBe(true);
        } catch (e) {
          logError(e, expect);
          throw e;
        }
      });
    }
  }

  if (!isGithubActions) {
    // Check if GM_BOT_ADDRESS environment variable is set
    const gmBotAddress = "0xD75FaA8A834570b4df073500F31E3103227299ed";

    it("should respond to a message", async () => {
      console.log("sending gm to bot", gmBotAddress);
      try {
        if (!gmBotAddress) {
          throw new Error("GM_BOT_ADDRESS environment variable is not set");
        }

        const xmtpTester = new XmtpPlaywright(false, "production", false);
        const result = await xmtpTester.newDmWithDeeplink(
          gmBotAddress,
          "hi",
          "added",
          //"You've been added to the Farcon group. Check your message requests in your inbox to view",
        );
        expect(result).toBe(true);
      } catch (error) {
        console.error("Error in browser test:", error);
        throw error;
      }
    });
  }
});
