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
  expectedMessage: string;
}

// Type assertion for imported JSON
const typedAgents = agentHealth as Agent[];

const testName = "ts_agent_health";
loadEnv(testName);

const targetAgentName = process.env.TARGET_AGENT_NAME;
const targetAgentAddress = process.env.TARGET_AGENT_ADDRESS;

describe(testName, () => {
  // If specific agent is targeted by CI matrix
  if (targetAgentName && targetAgentAddress) {
    const agent = typedAgents.find(
      (a) => a.name === targetAgentName && a.address === targetAgentAddress,
    );

    if (!agent) {
      throw new Error(
        `Agent ${targetAgentName} (${targetAgentAddress}) not found in agents list`,
      );
    }
    for (const network of agent.networks) {
      it(`should respond to message from ${agent.name} on ${network}`, async () => {
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
  } else {
    // For local testing, test all agents on their supported networks
    for (const agent of typedAgents) {
      for (const network of agent.networks) {
        it(`should respond to message from ${agent.name} on ${network}`, async () => {
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
  }
});
