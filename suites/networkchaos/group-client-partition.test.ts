import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";
import { DockerContainer } from "../../network-stability-utilities/container";
import * as iptables from "../../network-stability-utilities/iptables";
import type { Group } from "@xmtp/node-sdk";

const testName = "group-client-partitioning";
loadEnv(testName);

describe(testName, async () => {
  const workers = await getWorkers(
    {
      user1: "http://localhost:5556",
      user2: "http://localhost:5556",
      user3: "http://localhost:6556",
      user4: "http://localhost:6556",
    },
    testName,
    typeofStream.Message,
    typeOfResponse.Gm
  );

  setupTestLifecycle({ expect });

  const partitionNode = new DockerContainer("multinode-node2-1");
  const partitionPort = 6556;

  let group: Group;

  it("should verify group messaging during and after client-side blackhole partition", async () => {
    try {
      group = await workers.createGroup("Client Partition Test Group");
      await group.sync();
      await workers.checkIfGroupForked(group.id);

      const verifyInitial = await verifyMessageStream(group, workers.getAllButCreator());
      expect(verifyInitial.receiverCount).toBe(3);
      expect(verifyInitial.allReceived).toBe(true);

      console.log(`[test] Blocking host traffic to port ${partitionPort} (user3/user4's node)...`);
      iptables.blockHostPort(partitionPort);

      await new Promise((r) => setTimeout(r, 2000));

      console.log("[test] Sending 3 messages each from user1 and user2 during blackhole...");
      const senders = ["user1", "user2"];
      const midPartitionMessages: string[] = [];

      for (const sender of senders) {
        const convo = await workers.get(sender)!.client.conversations.getConversationById(group.id);
        for (let i = 1; i <= 3; i++) {
          const msg = `partition-msg-${sender}-${i}`;
          await convo!.send(msg);
          midPartitionMessages.push(msg);
        }
      }

      await workers.checkIfGroupForked(group.id);

      console.log("[verify-before-reconnect] Verifying user3/user4 did NOT receive messages during partition");
      for (const recipient of ["user3", "user4"]) {
        const convo = await workers.get(recipient)!.client.conversations.getConversationById(group.id);
        const msgs = await convo!.messages();
        for (const content of midPartitionMessages) {
          const seen = msgs.some((m) => m.content === content);
          console.log(`[verify-before-reconnect] ${recipient} saw "${content}": ${seen}`);
          expect(seen).toBe(false);
        }
      }

      console.log(`[reconnect] Reconnecting host traffic to port ${partitionPort}...`);
      iptables.unblockHostPort(partitionPort);

      await new Promise((r) => setTimeout(r, 3000));

      await workers.get("user3")!.client.conversations.getConversationById(group.id);
      await workers.get("user4")!.client.conversations.getConversationById(group.id);

      await workers.checkIfGroupForked(group.id);

      console.log("[verify-after-reconnect] Checking that user3 and user4 received all mid-partition messages (if supported)");
      for (const recipient of ["user3", "user4"]) {
        const convo = await workers.get(recipient)!.client.conversations.getConversationById(group.id);
        const msgs = await convo!.messages();
        for (const content of midPartitionMessages) {
          const seen = msgs.some((m) => m.content === content);
          console.log(`[verify-after-reconnect] ${recipient} saw "${content}": ${seen}`);
          expect(seen).toBe(true);
        }
      }

      console.log("[verify] Ensuring senders retained all sent messages");
      for (const recipient of ["user1", "user2"]) {
        const convo = await workers.get(recipient)!.client.conversations.getConversationById(group.id);
        const msgs = await convo!.messages();
        for (const content of midPartitionMessages) {
          const seen = msgs.some((m) => m.content === content);
          expect(seen).toBe(true);
        }
        expect(msgs.length).toBeGreaterThanOrEqual(midPartitionMessages.length);
      }

      console.log("[test] Final message delivery test");
      const verifyFinal = await verifyMessageStream(group, workers.getAllButCreator());
      expect(verifyFinal.receiverCount).toBe(3);
      expect(verifyFinal.allReceived).toBe(true);

      await workers.checkIfGroupForked(group.id);
    } catch (err) {
      logError(err, expect.getState().currentTestName);
      throw err;
    }
  });
});
