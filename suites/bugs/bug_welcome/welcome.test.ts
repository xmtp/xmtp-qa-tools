import { getFixedNames } from "@helpers/client";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "bug_welcome";

describe(testName, () => {
  let workers: WorkerManager;
  let group: Group;

  beforeAll(async () => {
    const names = getFixedNames(10);
    workers = await getWorkers(names);
    // Start message and conversation streams on demand
    workers.getAll().forEach((worker) => {
      worker.worker.startStream(typeofStream.Message);
      worker.worker.startStream(typeofStream.Conversation);
    });
  });

  it("stream: send the stream", async () => {
    group = await workers.createGroupBetweenAll();
    console.log("Group created", group.id);
    expect(group.id).toBeDefined();
  });
  it("stream: send the stream", async () => {
    group = await workers.createGroupBetweenAll();
    console.log("Group created", group.id);
    expect(group.id).toBeDefined();
  });
});
