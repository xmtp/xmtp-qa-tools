import { loadEnv } from "@helpers/client";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Client, Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "bug_welcome";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  let group: Group;
  let creatorClient: Client;

  beforeAll(async () => {
    const creator = await getWorkers(["bot"], testName);
    creatorClient = creator.get("bot")?.client as Client;
    if (!creatorClient) {
      throw new Error("Creator not found");
    }
    workers = await getWorkers(
      ["bob", "alice", "joe", "sam", "charlie"],
      testName,
    );
  });

  it("tc_stream: send the stream", async () => {
    group = await creatorClient.conversations.newGroup(
      workers.getWorkers().map((p) => p.client.inboxId),
    );
    console.log("Group created", group.id);
    expect(group.id).toBeDefined();
  });
});
