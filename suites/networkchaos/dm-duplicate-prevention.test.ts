import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { type Dm } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import { DockerContainer } from "../../network-stability-utilities/container";

const testName = "dm-duplicate-prevention";
loadEnv(testName);

describe(testName, async () => {
  const workers = await getWorkers(
    {
      henry: "http://localhost:5556",
      randomguy: "http://localhost:6556",
    },
    testName,
    typeofStream.Message,
  );

  setupTestLifecycle({ testName, expect });

  const node2 = new DockerContainer("multinode-node2-1"); // Henry

  it("should not deliver duplicate DMs under retry and degraded network conditions", async () => {
    let conversation: Dm;

    try {
      conversation = (await workers
        .get("henry")!
        .client.conversations.newDm(workers.get("randomguy")!.client.inboxId)) as Dm;

      const messageContent = "dedupe-chaos-" + Date.now();

      // Force SDK into retry state by blocking host -> container
      console.log("[test] Blocking host -> container before send to force retry...");
      node2.blockInboundFromHost();
      console.log("[test] Applying latency, jitter, and packet loss to sender node...");
      const delay = Math.floor(400 + Math.random() * 200);   // 400-600ms
      const jitter = Math.floor(Math.random() * 100);        // 0-100ms
      const loss = Math.random() * 5;                        // 0-5%

      try {
        node2.addJitter(delay, jitter);
        node2.addLoss(loss);
      } catch (err) {
        console.warn("[test] Failed applying netem:", err);
      }

      const start = Date.now();
      const sendPromise = conversation.send(messageContent);
      console.log("[test] Message send initiated, waiting under partition...");

      await new Promise((r) => setTimeout(r, 3000)); // Let send timeout internally
      console.log("[test] Unblocking to allow retry...");
      node2.unblockFromHost();

      // Allow time for retry to succeed under chaos
      await sendPromise.catch((err) => {
        console.warn("[warn] send() threw error (may still retry):", err.message || err);
      });

      const duration = Date.now() - start;
      console.log("[debug] Total send() duration (ms):", duration);

      await new Promise((r) => setTimeout(r, 3000)); // Let retry complete

      // Clear network chaos
      node2.clearLatency();

      console.log("[verify] Checking how many messages were received by randomguy...");

      const convoFromReceiver = await workers
        .get("randomguy")!
        .client.conversations.newDm(workers.get("henry")!.client.inboxId);

      const received = await convoFromReceiver.messages();
      const matching = received.filter((m) => m.content === messageContent);

      for (const m of matching) {
        const ts = new Date(Number(m.sentAtNs) / 1e6).toISOString();
        console.log("[recv] [" + ts + "]: " + m.content);
      }

      expect(matching.length).toBe(1); // Validate deduplication held

    } catch (err) {
      logError(err, expect.getState().currentTestName);
      node2.clearLatency();
      throw err;
    }
  });
});
