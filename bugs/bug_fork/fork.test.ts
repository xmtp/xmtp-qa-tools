import { loadEnv } from "@helpers/client";
import { getManualUsers, sleep } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const TEST_NAME = "bug_fork";
loadEnv(TEST_NAME);

describe(TEST_NAME, () => {
  let workers: WorkerManager;
  let secondWorkers: WorkerManager;
  let creator: Worker;
  let globalGroup: Group;

  setupTestLifecycle({
    expect,
  });

  it("create group", async () => {
    try {
      // Initialize workers with creator and test workers
      workers = await getWorkers(
        ["bob", "alice", "dave", "charlie"],
        TEST_NAME,
      );

      creator = workers.getCreator();
      if (!creator) {
        throw new Error(`Creator worker 'bob' not found`);
      }

      // Create or get the global test group
      globalGroup = await workers.createGroup();
      if (!globalGroup?.id) {
        throw new Error("Failed to create or retrieve global group");
      }
      await sleep(1000);
      await globalGroup.addMembers(
        getManualUsers().map((user) => user.inboxId),
      );

      // Send initial test message
      await globalGroup.send(`Starting stress test: ${TEST_NAME}`);
      await sleep(1000);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to setup test environment:", errorMessage);
      throw error;
    }
  });

  it("bot B is created and alice syncs and sends messages", async () => {
    const alice = workers.get("alice");
    if (!alice) {
      throw new Error("Alice worker not found");
    }
    await alice.client.conversations.syncAll();
    await alice.client.conversations.sync();
    const aliceGroup = await alice.client.conversations.getConversationById(
      globalGroup.id,
    );
    if (!aliceGroup) {
      throw new Error("Alice group not found");
    }
    await aliceGroup.send("hi from alice1");
    await sleep(1000);
    secondWorkers = await getWorkers(["bob-b"], TEST_NAME);
    const botB = secondWorkers.get("bob-b");
    if (!botB) {
      throw new Error("Bot B worker not found");
    }
    await aliceGroup.send("hi from alice2");
    await sleep(1000);
    await aliceGroup.send("hi from alice3");
    await sleep(1000);
    await sleep(1000);
    await sleep(1000);
    await sleep(1000);
    await botB.client.conversations.syncAll();
    await botB.client.conversations.sync();
    const botBGroup = await botB.client.conversations.getConversationById(
      globalGroup.id,
    );
    if (!botBGroup) {
      throw new Error("Bot B group not found");
    }
    const messages = await botBGroup.messages();
    console.log(messages.map((m) => m.content));
  });
});
