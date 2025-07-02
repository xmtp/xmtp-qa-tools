import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

describe("bug_welcome", () => {
  let workers: WorkerManager;
  let group: Group;

  beforeAll(async () => {
    workers = await getWorkers(10);
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
