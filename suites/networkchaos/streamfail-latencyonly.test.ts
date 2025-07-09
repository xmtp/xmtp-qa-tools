import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { type Dm } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import { DockerContainer } from "../../network-stability-utilities/container";

const testName = "dm-duplicate-chaos";
describe(testName, async () => {
  const workers = await getWorkers({
    henry: "http://localhost:5556",
    randomguy: "http://localhost:6556",
  });
  // Start message streams for duplicate prevention test
  workers.startStream(typeofStream.Message);

  setupTestLifecycle({ testName });

  const node1 = new DockerContainer("multinode-node1-1");
  const node2 = new DockerContainer("multinode-node2-1");
  const node3 = new DockerContainer("multinode-node3-1");
  const node4 = new DockerContainer("multinode-node4-1");

  it("should not deliver duplicate DMs under retry and degraded network conditions", async () => {
    let conversation: Dm;

    try {
      conversation = (await workers
        .get("henry")!
        .client.conversations.newDm(
          workers.get("randomguy")!.client.inboxId,
        )) as Dm;

      const messageContent = "dedupe-chaos-" + String(Date.now());

      console.log(
        "[test] Applying latency, jitter, and packet loss to sender node...",
      );
      const delay = Math.floor(15000 + Math.random() * 200);
      const jitter = Math.floor(Math.random() * 100);
      const loss = Math.random() * 5;

      try {
        node1.addJitter(delay, jitter);
        node1.addLoss(loss);
        node2.addJitter(delay, jitter);
        node2.addLoss(loss);
        node3.addJitter(delay, jitter);
        node3.addLoss(loss);
        node4.addJitter(delay, jitter);
        node4.addLoss(loss);
        
      } catch (err: unknown) {
        console.warn("[test] Failed applying netem:", err);
      }

      const start = Date.now();
      const sendPromise = conversation.send(messageContent);
      console.log("[test] Message send initiated, waiting under latency - should get stream timeout");

      const duration = Date.now() - start;
      console.log("[debug] Total send() duration (ms):", duration);

      await new Promise((r) => setTimeout(r, 20000));

      // Clear network chaos
      node2.clearLatency();

      console.log(
        "[verify] Checking how many messages were received by randomguy...",
      );

      const convoFromReceiver = await workers
        .get("randomguy")!
        .client.conversations.newDm(workers.get("henry")!.client.inboxId);

      const received = await convoFromReceiver.messages();
      const matching = received.filter((m) => m.content === messageContent);

      for (const m of matching) {
        const ts = new Date(Number(m.sentAtNs) / 1e6).toISOString();
        const safeContent =
          typeof m.content === "string" ? m.content : JSON.stringify(m.content);
        console.log("[recv] [" + ts + "]: " + safeContent);
      }

      expect(matching.length).toBe(1);
    } catch (err) {
      console.error(err);
      node2.clearLatency();
    }
  });
});
