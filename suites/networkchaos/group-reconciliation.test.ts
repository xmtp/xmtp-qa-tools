import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import { DockerContainer } from "../../network-stability-utilities/container";

const testName = "group-reconciliation";
loadEnv(testName);

describe(testName, async () => {
  const workers = await getWorkers(
    {
      user1: "http://localhost:5556",
      user2: "http://localhost:6556",
      user3: "http://localhost:7556",
      user4: "http://localhost:8556",
    },
    testName,
    typeofStream.Message,
    typeOfResponse.Gm,
  );

  setupTestLifecycle({ testName, expect });

  let group: Group;

  it("should recover and sync group state after node isolation", async () => {
    try {
      // Create group with users 1-3
      group = await workers.createGroupBetweenAll("Test Group", [
        "user1",
        "user2",
        "user3",
      ]);
      await group.sync();
      console.log("[test] Initial group created");

      const user1Group = await workers
        .get("user1")!
        .client.conversations.getConversationById(group.id);
      console.log("Sending welcome message from user1...");
      await user1Group?.send("Initial welcome message from user1");
      await new Promise((res) => setTimeout(res, 3000));

      console.log(
        "[test] Dumping messages received by group members and confirming user4 has no convo yet:",
      );
      const users = ["user1", "user2", "user3", "user4"];
      for (const name of users) {
        const client = workers.get(name)?.client;
        const convo =
          client && (await client.conversations.getConversationById(group.id));
        if (!convo) {
          if (name === "user4") {
            // check if env dirty
            expect(convo).toBeFalsy();
            console.log("  [user4] No conversation found - expected.");
          } else {
            throw new Error(`[${name}] convo unexpectedly undefined`);
          }
          continue;
        }
        expect(convo).toBeTruthy();
        const messages = await convo.messages();
        console.log(
          "  [" + name + "] Received " + String(messages.length) + " messages:",
        );
        for (const msg of messages) {
          const timestamp = msg.sentAt
            ? new Date(msg.sentAt).toISOString()
            : "unknown";
          const safeContent =
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content);
          console.log("    [" + timestamp + "] " + safeContent);
        }
      }

      // Isolate node3 from replication cluster (user3)
      const node1 = new DockerContainer("multinode-node1-1");
      const node2 = new DockerContainer("multinode-node2-1");
      const node3 = new DockerContainer("multinode-node3-1");
      const node4 = new DockerContainer("multinode-node4-1");
      node1.blockOutboundTrafficTo(node3);
      node2.blockOutboundTrafficTo(node3);
      node4.blockOutboundTrafficTo(node3);
      node3.blockOutboundTrafficTo(node1);
      node3.blockOutboundTrafficTo(node2);
      node3.blockOutboundTrafficTo(node4);
      await new Promise((res) => setTimeout(res, 5000));
      console.log("[test] Isolated node3 (user3) from cluster");

      // User1 adds user4 to group
      console.log("Sending welcome message from user1...");
      await user1Group?.send(
        "Additional welcome message from user1 before user4 joins...",
      );
      await (user1Group as Group).addMembers([
        workers.get("user4")!.client.inboxId,
      ]);
      await new Promise((res) => setTimeout(res, 3000));

      console.log("[test] user4 added to group");
      await user1Group?.send("User1: user4 just joined!!");
      await new Promise((res) => setTimeout(res, 3000));

      console.log("[test] Dumping messages received by group members:");
      for (const name of users) {
        const client = workers.get(name)?.client;
        const convo =
          client && (await client.conversations.getConversationById(group.id));
        if (!convo) {
          console.log("  [" + name + "] No conversation found.");
          continue;
        }
        const messages = await convo.messages();
        console.log(
          "  [" + name + "] Received " + String(messages.length) + " messages:",
        );
        for (const msg of messages) {
          const timestamp = msg.sentAt
            ? new Date(msg.sentAt).toISOString()
            : "unknown";
          const safeContent =
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content);
          console.log("    [" + timestamp + "] " + safeContent);
        }
      }

      // Sync user4 with the group
      const user4Group = await workers
        .get("user4")!
        .client.conversations.getConversationById(group.id);
      await user4Group?.sync();
      console.log("[test] user4 joined and synced");

      // Restore network
      node1.unblockOutboundTrafficTo(node3);
      node2.unblockOutboundTrafficTo(node3);
      node4.unblockOutboundTrafficTo(node3);
      node3.unblockOutboundTrafficTo(node1);
      node3.unblockOutboundTrafficTo(node2);
      node3.unblockOutboundTrafficTo(node4);
      await new Promise((r) => setTimeout(r, 3000));
      console.log("[test] Restored node3's connectivity");

      const user3Group = await workers
        .get("user3")!
        .client.conversations.getConversationById(group.id);
      await user3Group?.sync();
      const membersAfterRecovery = await user3Group?.members();
      console.log("[test] user3 sees group members after partition recovery:");
      membersAfterRecovery?.forEach((m) => {
        console.log("  " + m.inboxId);
      });

      const user4Id = workers.get("user4")!.client.inboxId;
      const recoveryMsg = "User4 says hello - user3 should see me too!";
      await user4Group?.send(recoveryMsg);
      console.log("[test] user4 sent post-recovery message");

      // Poll user3 until it sees updated members
      let found = false;
      for (let attempts = 0; attempts < 5 && !found; attempts++) {
        await user3Group?.sync();

        const members = await user3Group?.members();
        const hasUser4 = members?.some((m) => m.inboxId === user4Id);
        if (hasUser4) {
          console.log("[test] user3 sees user4 after receiving new message");
          found = true;
          break;
        }

        const msgs = await user3Group?.messages();
        if (
          msgs?.some(
            (m) =>
              typeof m.content === "string" && m.content.includes(recoveryMsg),
          )
        ) {
          console.log("[test] user3 received recovery message");
        }

        console.log(
          "[test] retrying group sync check (" + String(attempts + 1) + "/5)",
        );
        await new Promise((r) => setTimeout(r, 1000));
      }

      expect(found).toBe(true);
      console.log("[test] Group reconciliation and message recovery succeeded");

      const verifyFinal = await verifyMessageStream(
        group,
        workers.getAllButCreator(),
      );
      expect(verifyFinal.allReceived).toBe(true);
    } catch (err) {
      logError(err, expect.getState().currentTestName);
      throw err;
    }
  });
});
