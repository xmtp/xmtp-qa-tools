import { loadEnv } from "@helpers/client";
import { getTime } from "@helpers/logger";
import { getManualUsers, sleep } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { createOrGetNewGroup } from "suites/stress/group-stress/helper";
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

      creator = workers.get("bob") as Worker;
      if (!creator) {
        throw new Error(`Creator worker 'bob' not found`);
      }

      // Create or get the global test group
      globalGroup = await createOrGetNewGroup(
        creator,
        getManualUsers(["fabri"]).map((user) => user.inboxId),
        workers.getAllBut("bob").map((w) => w.client.inboxId),
        "d612811411d8aba6741a7c67cf8a8001",
        TEST_NAME,
        "NotForked",
      );

      if (!globalGroup?.id) {
        throw new Error("Failed to create or retrieve global group");
      }
      // Send initial test message
      await globalGroup.send(`Starting stress test: ${TEST_NAME}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to setup test environment:", errorMessage);
      throw error;
    }
  });

  it("all workers send a message", async () => {
    const allWorkers = workers.getAllBut("bob");
    secondWorkers = await getWorkers(
      ["bob-b"],
      TEST_NAME,
      typeofStream.Message,
      typeOfResponse.Gm,
      typeOfSync.Both,
    );

    for (const worker of allWorkers) {
      await worker.client.conversations.syncAll();
      await worker.client.conversations.sync();
      const group = await worker.client.conversations.getConversationById(
        globalGroup.id,
      );
      if (!group) {
        throw new Error("Group not found");
      }
      await group.send(
        `hi from ${worker.name} to ${allWorkers.map((w) => w.name).join(", ")}`,
      );
    }
  });

  it("bot B is created and syncs and sends messages", async () => {
    const botB = secondWorkers.get("bob-b");
    if (!botB) {
      throw new Error("Bot B worker not found");
    }
    await botB.client.conversations.syncAll();
    await botB.client.conversations.sync();
    const botBGroup = await botB.client.conversations.getConversationById(
      globalGroup.id,
    );
    if (!botBGroup) {
      throw new Error("Bot B group not found");
    }
    const messages = await botBGroup.messages();
    console.log(messages.map((m) => m.content).join("\n"));
    await botBGroup.send("hi from bot B");
  });
});
