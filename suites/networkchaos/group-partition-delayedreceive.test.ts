import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import { DockerContainer } from "../../network-stability-utilities/container";

describe("group-partition-delayedreceive", async () => {
  const workers = await getWorkers({
    user1: "http://localhost:5556",
    user2: "http://localhost:5556",
    user3: "http://localhost:6556",
    user4: "http://localhost:6556",
  });
  // Start message and response streams for the chaos testing

  setupTestLifecycle({});

  const node1 = new DockerContainer("multinode-node1-1");
  const node2 = new DockerContainer("multinode-node2-1");
  const node3 = new DockerContainer("multinode-node3-1");
  const node4 = new DockerContainer("multinode-node4-1");

  let group: Group;

  it("should verify group messaging with partitioning", async () => {
    try {
      group = await workers.createGroupBetweenAll("Partition Test Group");
      await group.sync();

      console.log("[test] Sending group message before partition");
      const verifyInitial = await verifyMessageStream(
        group,
        workers.getAllButCreator(),
      );
      expect(verifyInitial.receiverCount).toBe(3);
      expect(verifyInitial.allReceived).toBe(true);

      console.log("[test] Isolating node2 from nodes 1/3/4...");
      node1.blockOutboundTrafficTo(node2);
      node3.blockOutboundTrafficTo(node2);
      node4.blockOutboundTrafficTo(node2);
      node2.blockOutboundTrafficTo(node1);
      node2.blockOutboundTrafficTo(node3);
      node2.blockOutboundTrafficTo(node4);

      console.log("[test] Waiting for partition to fully apply...");
      await new Promise((r) => setTimeout(r, 2000));

      const midPartitionMsg = "group-msg-during-partition";
      console.log(
        "[test] Sending message during partition: " + midPartitionMsg,
      );

      const user2Group = await workers
        .get("user2")!
        .client.conversations.getConversationById(group.id);
      await user2Group!.send(midPartitionMsg);
      await workers.checkForks();

      console.log("=== Message Dump After Partition ===");
      for (const name of ["user1", "user2", "user3", "user4"]) {
        const g = await workers
          .get(name)!
          .client.conversations.getConversationById(group.id);
        const msgs = await g!.messages();
        console.log("Messages seen by " + name + ":");
        for (const msg of msgs) {
          const ts = new Date(Number(msg.sentAtNs) / 1e6).toISOString();
          const safeContent =
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content);
          console.log("- [" + ts + "]: " + safeContent);
        }
      }
      console.log("=== Done ===");

      const user3Group = await workers
        .get("user3")!
        .client.conversations.getConversationById(group.id);
      const user4Group = await workers
        .get("user4")!
        .client.conversations.getConversationById(group.id);

      const user2Msgs = await user2Group!.messages();
      const user3Msgs = await user3Group!.messages();
      const user4Msgs = await user4Group!.messages();

      const user2SawMid = user2Msgs.some((m) => m.content === midPartitionMsg);
      const user3SawMid = user3Msgs.some((m) => m.content === midPartitionMsg);
      const user4SawMid = user4Msgs.some((m) => m.content === midPartitionMsg);

      console.log("[verify] user2 should see message: " + String(user2SawMid));
      console.log(
        "[verify] user3 should NOT see message: " + String(user3SawMid),
      );
      console.log(
        "[verify] user4 should NOT see message: " + String(user4SawMid),
      );

      expect(user2SawMid).toBe(true);
      expect(user3SawMid).toBe(false);
      expect(user4SawMid).toBe(false);

      console.log("[test] Recovering partition");
      node1.unblockOutboundTrafficTo(node2);
      node3.unblockOutboundTrafficTo(node2);
      node4.unblockOutboundTrafficTo(node2);
      node2.unblockOutboundTrafficTo(node1);
      node2.unblockOutboundTrafficTo(node3);
      node2.unblockOutboundTrafficTo(node4);

      await new Promise((r) => setTimeout(r, 3000));
      await workers.checkForks();

      const postRecoveryMsgs = await Promise.all(
        ["user3", "user4"].map(async (name) => {
          const g = await workers
            .get(name)!
            .client.conversations.getConversationById(group.id);
          const msgs = await g!.messages();
          return msgs.some((m) => m.content === midPartitionMsg);
        }),
      );

      expect(postRecoveryMsgs.every(Boolean)).toBe(true);

      console.log("[test] Verifying group message after recovery");
      const verifyFinal = await verifyMessageStream(
        group,
        workers.getAllButCreator(),
      );
      expect(verifyFinal.receiverCount).toBe(3);
      expect(verifyFinal.allReceived).toBe(true);
      await workers.checkForks();
    } catch (err) {
      throw err;
    }
  });
});
