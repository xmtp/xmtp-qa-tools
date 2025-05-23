import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { getInboxIds, getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "performance";
loadEnv(testName);

describe(testName, async () => {
  const batchSize = parseInt(process.env.BATCH_SIZE ?? "5");
  const total = parseInt(process.env.MAX_GROUP_SIZE ?? "10");
  console.log(`[${testName}] Batch size: ${batchSize}, Total: ${total}`);
  let dm: Conversation;
  let workers: WorkerManager;

  workers = await getWorkers(
    getRandomNames(10),
    testName,
    typeofStream.Message,
  );

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
    expect,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
  });
  let i = 4;
  let newGroup: Conversation;
  it(`createGroup: should create a large group of ${i} participants ${i}`, async () => {
    try {
      const sliced = getInboxIds(i);
      newGroup = await workers
        .getCreator()
        .client.conversations.newGroup([
          ...sliced,
          ...workers.getAllButCreator().map((w) => w.client.inboxId),
        ]);
      console.log("New group created", newGroup.id);
      expect(newGroup.id).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it(`receiveGroupMessage: should measure receiving a gm in a group of ${batchSize} participants`, async () => {
    try {
      const verifyResult = await verifyMessageStream(
        newGroup,
        workers.getAllButCreator(),
      );
      expect(verifyResult.allReceived).toBe(true);
      setCustomDuration(verifyResult.averageEventTiming);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  for (let i = batchSize; i <= total; i += batchSize) {
    let newGroup: Conversation;
    it(`createGroup-${i}: should create a large group of ${i} participants ${i}`, async () => {
      try {
        const sliced = getInboxIds(i);
        newGroup = await workers
          .getCreator()
          .client.conversations.newGroup([
            ...sliced,
            ...workers.getAllButCreator().map((w) => w.client.inboxId),
          ]);
        expect(newGroup.id).toBeDefined();
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
    it(`receiveGroupMessage-${i}: should create a group and measure all streams`, async () => {
      try {
        const verifyResult = await verifyMessageStream(
          newGroup,
          workers.getAllButCreator(),
        );
        setCustomDuration(verifyResult.averageEventTiming);
        expect(verifyResult.allReceived).toBe(true);
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
