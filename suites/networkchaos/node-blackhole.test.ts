import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import { DockerContainer } from "../../network-stability-utilities/container";

const testName = "group-node-blackhole";
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
    typeOfResponse.Gm,
  );

  setupTestLifecycle({ testName, expect });

  const node1 = new DockerContainer("multinode-node1-1");
  const node2 = new DockerContainer("multinode-node2-1");
  const node3 = new DockerContainer("multinode-node3-1");
  const node4 = new DockerContainer("multinode-node4-1");

  let group: Group;
  const expectedMessages = ["gm-bh-1", "gm-bh-2", "gm-bh-3"];

  it("should simulate a node blackhole in a group chat and recover cleanly", async () => {
    try {
      console.log("[test] Creating group conversation");
      group = await workers.createGroupBetweenAllWorkers(
        "Blackhole Group Test",
      );
      await group.sync();

      console.log("[test] Verifying initial message delivery to all");
      const preCheck = await verifyMessageStream(
        group,
        workers.getAllButCreator(),
      );
      expect(preCheck.allReceived).toBe(true);

      console.log("[test] Applying blackhole: isolating node2 from node1/3/4");
      node2.simulateBlackhole([node1, node3, node4]);

      console.log(
        "[test] Sending 3 group messages DURING blackhole from user2",
      );
      const user2Group = await workers
        .get("user2")!
        .client.conversations.getConversationById(group.id);
      for (const msg of expectedMessages) {
        await user2Group!.send(msg);
      }

      await new Promise((res) => setTimeout(res, 3000));

      console.log("=== Message Dump During Blackhole ===");
      for (const name of ["user1", "user2", "user3", "user4"]) {
        const g = await workers
          .get(name)!
          .client.conversations.getConversationById(group.id);
        const msgs = await g!.messages();
        console.log(`Messages seen by ${name}:`);
        for (const msg of msgs) {
          const ts = new Date(Number(msg.sentAtNs) / 1e6).toISOString();
          const safeContent =
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content);
          console.log(`- [${ts}]: ${safeContent}`);
        }
      }

      console.log("[test] Verifying user2 sees all their messages");
      const user2Msgs = await user2Group!.messages();
      for (const msg of expectedMessages) {
        expect(user2Msgs.some((m) => m.content === msg)).toBe(true);
      }

      console.log(
        "[test] Verifying user3 and user4 do NOT see any messages during blackhole",
      );
      const user3Group = await workers
        .get("user3")!
        .client.conversations.getConversationById(group.id);
      const user4Group = await workers
        .get("user4")!
        .client.conversations.getConversationById(group.id);
      const user3Msgs = await user3Group!.messages();
      const user4Msgs = await user4Group!.messages();
      for (const msg of expectedMessages) {
        expect(user3Msgs.some((m) => m.content === msg)).toBe(false);
        expect(user4Msgs.some((m) => m.content === msg)).toBe(false);
      }

      console.log("[test] Lifting blackhole");
      node2.clearBlackhole([node1, node3, node4]);
      await new Promise((res) => setTimeout(res, 3000));
      await workers.checkForks();

      console.log("[test] Verifying messages are now received post-blackhole");
      const updatedUser3Msgs = await user3Group!.messages();
      const updatedUser4Msgs = await user4Group!.messages();
      for (const msg of expectedMessages) {
        expect(updatedUser3Msgs.some((m) => m.content === msg)).toBe(true);
        expect(updatedUser4Msgs.some((m) => m.content === msg)).toBe(true);
      }

      console.log("[test] Verifying post-recovery stream");
      const postCheck = await verifyMessageStream(
        group,
        workers.getAllButCreator(),
      );
      expect(postCheck.allReceived).toBe(true);
      expect(postCheck.orderPercentage).toBe(100);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
