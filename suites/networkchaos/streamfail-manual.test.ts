import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "group-node-restart-monitor";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  const workers = await getWorkers({
    user1: "http://localhost:5556",
    user2: "http://localhost:5556",
    user3: "http://localhost:6556",
    user4: "http://localhost:6556",
  });

  // Start streaming for MessageandResponse type
  workers.startStream(typeofStream.MessageandResponse);

  let group: Group;
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  it("should continuously verify message delivery while containers are manually restarted", async () => {
    console.log("[test] Creating group conversation");
    group = await workers.createGroupBetweenAll("Container restart stream test");
    await group.sync();

    console.log("[test] Initial message delivery check...");
    const preCheck = await verifyMessageStream(group, workers.getAllButCreator());
    console.log("[verify] Initial message result:", preCheck);

    console.log("[loop] Beginning continuous stream monitoring. Kill docker containers now to simulate failure.");
    while (true) {
      const result = await verifyMessageStream(group, workers.getAllButCreator());
      console.log(`[loop][verify] Received=${result.allReceived} Order=${result.orderPercentage}%`);
      await delay(5000); // 5s between checks
    }
  });
});
