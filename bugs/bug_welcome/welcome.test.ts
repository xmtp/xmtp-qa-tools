import { loadEnv } from "@helpers/client";
import { getFixedNames, getRandomNames } from "@helpers/tests";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Client, Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "bug_welcome";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  let group: Group;

  beforeAll(async () => {
    const names = getFixedNames(10);
    workers = await getWorkers(names, testName, typeofStream.Message);
    await getWorkers(names, testName, typeofStream.Conversation);
  });

  it("stream: send the stream", async () => {
    const creator = workers.getCreator();
    group = await creator.client.conversations.newGroup(
      workers.getAllButCreator().map((p) => p.client.inboxId),
    );
    console.log("Group created", group.id);
    expect(group.id).toBeDefined();
  });
  it("stream: send the stream", async () => {
    const creator = workers.getCreator();
    group = await creator.client.conversations.newGroup(
      workers.getAllButCreator().map((p) => p.client.inboxId),
    );
    console.log("Group created", group.id);
    expect(group.id).toBeDefined();
  });
});
