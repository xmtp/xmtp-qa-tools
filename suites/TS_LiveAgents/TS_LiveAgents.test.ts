import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { XmtpPlaywright } from "@helpers/playwright";
import type { XmtpEnv } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import liveAgents from "./agents.json";

const testName = "ts_live_agents";
loadEnv(testName);

describe(testName, () => {
  for (const agent of liveAgents) {
    it(`should respond to message from ${agent.name}`, async () => {
      try {
        console.log(`Testing ${agent.name}`);
        for (const env of agent.env) {
          const xmtpTester = new XmtpPlaywright(false, env as XmtpEnv);
          const result = await xmtpTester.newDmWithDeeplink(
            agent.address,
            agent.sendMessage as string,
            agent.expectedMessage as string,
          );
          expect(result).toBe(true);
        }
      } catch (e) {
        logError(e, expect);
      }
    });
  }
});
