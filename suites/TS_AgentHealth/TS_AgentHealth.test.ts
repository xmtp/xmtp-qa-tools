import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { XmtpPlaywright } from "@helpers/playwright";
import type { XmtpEnv } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import agentHealth from "./agents.json";

// Define the types for the agents
interface Agent {
  name: string;
  address: string;
  networks: string[];
  sendMessage: string;
  expectedMessage?: string;
}

// Type assertion for imported JSON
const typedAgents = agentHealth as Agent[];
const testName = "ts_agenthealth";
loadEnv(testName);

describe(testName, () => {
  // For local testing, test all agents on their supported networks
  for (const agent of typedAgents) {
    for (const network of agent.networks) {
      it(`Check ${agent.name} health on ${network} network`, async () => {
        try {
          console.log(
            `Testing ${agent.name} with address ${agent.address} on ${network}`,
          );
          const xmtpTester = new XmtpPlaywright({
            headless: true,
            env: network as XmtpEnv,
          });
          const result = await xmtpTester.newDmWithDeeplink(
            agent.address,
            agent.sendMessage,
            agent.expectedMessage ?? undefined,
          );
          expect(result).toBe(true);
        } catch (e) {
          logError(e, expect.getState().currentTestName);
          throw e;
        }
      });
    }
  }
});
