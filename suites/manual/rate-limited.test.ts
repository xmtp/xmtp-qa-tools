import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { type Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "rate-limited";
loadEnv(testName);

describe(testName, async () => {
  const workers = await getWorkers(["henry", "ivy", "jack", "karen"], testName);

  let dm: Conversation;

  setupTestLifecycle({
    expect,
  });

  it("createDm: should create a DM for rate limiting test", async () => {
    try {
      dm = await workers
        .get("henry")!
        .client.conversations.newDm(workers.get("ivy")!.client.inboxId);

      expect(dm).toBeDefined();
      expect(dm.id).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("massiveBurst: should send 200 messages instantly to trigger rate limiting", async () => {
    try {
      const messageCount = 2000; // Send 200 messages instantly
      const startTime = Date.now();

      console.log(`🚀 SENDING ${messageCount} MESSAGES AS FAST AS POSSIBLE...`);

      // Create all promises at once - no delays, no waiting
      const sendPromises = [];
      for (let i = 0; i < messageCount; i++) {
        const message = `BURST-${i}-${Date.now()}-${Math.random()}`;
        sendPromises.push(dm.send(message));
      }

      console.log(`📤 All ${messageCount} send operations initiated...`);

      // Fire them all at once and see what happens
      const results = await Promise.allSettled(sendPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Count results
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      console.log(`\n💥 BURST RESULTS:`);
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`✅ Successful: ${successful}`);
      console.log(`❌ Failed: ${failed}`);
      console.log(
        `📊 Success rate: ${((successful / messageCount) * 100).toFixed(1)}%`,
      );
      console.log(
        `⚡ Rate: ${((messageCount / duration) * 1000).toFixed(1)} msg/sec`,
      );

      // Log first few errors to see rate limiting messages
      console.log(`\n🔍 FIRST 10 ERRORS:`);
      let errorCount = 0;
      results.forEach((result, index) => {
        if (result.status === "rejected" && errorCount < 10) {
          const errorMessage =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          console.log(`❌ Message ${index}: ${errorMessage}`);
          errorCount++;
        }
      });

      // We expect at least some messages to succeed
      expect(successful).toBeGreaterThan(0);

      if (failed > 0) {
        console.log(
          `\n🎯 SUCCESS! Rate limiting triggered - ${failed} messages failed!`,
        );
      } else {
        console.log(
          `\n⚠️  No rate limiting detected - all ${messageCount} messages sent successfully`,
        );
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
