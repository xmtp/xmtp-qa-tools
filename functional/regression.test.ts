import { closeEnv, loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { verifyStreamAll } from "@helpers/tests";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Conversation } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";

const testName = "regression";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  const versions = ["47", "100", "105", "200"];
  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  for (const version of versions) {
    it(`Shoudl test the DB after upgrade from ${version}`, async () => {
      workers = await getWorkers(["bob-" + "a" + "-" + version], testName);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const bob = workers.get("bob");
      const inboxId = generatedInboxes[0].inboxId;
      console.log("inboxId", inboxId);
      let convo;
      if (version === "47") {
        // @ts-expect-error: SDK version compatibility issues
        convo = await bob?.client.conversations.newDmByInboxId(inboxId);
      } else {
        convo = await bob?.client.conversations.newDm(inboxId);
      }
      expect(convo?.id).toBeDefined();
    });
  }
  it("should create a group conversation with all workers", async () => {
    workers = await getWorkers(
      ["henry-b-100", "steve-b-100", "joe-b-105", "alice-b-200"],
      testName,
    );
    const henry = workers.get("henry", "b");
    const steve = workers.get("steve", "b");
    const joe = workers.get("joe", "b");
    const alice = workers.get("alice", "b");
    const group = (await henry?.client.conversations.newGroup([
      steve?.inboxId as string,
      joe?.inboxId as string,
      alice?.inboxId as string,
    ])) as Conversation;
    console.log(`Group created with id ${group?.id}`);

    const verifyResult = await verifyStreamAll(group, workers);
    expect(verifyResult.allReceived).toBe(true);
  });
});
