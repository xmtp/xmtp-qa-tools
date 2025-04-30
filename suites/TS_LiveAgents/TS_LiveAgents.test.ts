import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { XmtpPlaywright } from "@helpers/playwright";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

const liveAgents = [
  {
    name: "bankr.base.eth",
    address: "0x7f1c0d2955f873fc91f1728c19b2ed7be7a9684d",
  },
  {
    name: "clankerchat.base.eth",
    address: "0x9E73e4126bb22f79f89b6281352d01dd3d203466",
  },
];
const testName = "ts_live_agents";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;

  beforeAll(async () => {
    try {
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

  for (const agent of liveAgents) {
    it("should respond to a message", async () => {
      try {
        const xmtpTester = new XmtpPlaywright(false, "production");
        const result = await xmtpTester.newDmWithDeeplink(agent.address, "hey");
        expect(result).toBe(true);
      } catch (e) {
        logError(e, expect);
        throw e;
      }
    });
  }
});
