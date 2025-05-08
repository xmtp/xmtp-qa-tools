import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "ts_group_performance";
loadEnv(testName);

describe(testName, async () => {
  const batchSize = 100;
  const total = 400;
  let workers: WorkerManager;
  let start: number;
  let hasFailures: boolean = false;
  let testStart: number;

  workers = await getWorkers(
    10,
    testName,
    typeofStream.Message,
    typeOfResponse.None,
  );

  setupTestLifecycle({
    expect,
    workers,
    testName,
    hasFailuresRef: hasFailures,
    getStart: () => start,
    setStart: (v) => {
      start = v;
    },
    getTestStart: () => testStart,
    setTestStart: (v) => {
      testStart = v;
    },
  });

  for (let i = batchSize; i <= total; i += batchSize) {
    let newGroup: Conversation;
    it(`createLargeGroup-${i}: should create a large group of ${i} participants ${i}`, async () => {
      try {
        const sliced = generatedInboxes.slice(0, i);
        newGroup = await workers
          .getWorkers()[0]
          .client.conversations.newGroup(sliced.map((inbox) => inbox.inboxId));
        expect(newGroup.id).toBeDefined();
        console.log(`Creating group with ${i} participants`);

        console.log(`Adding ${workers.getWorkers().length} participants`);

        await (newGroup as Group).addMembers(
          workers.getWorkers().map((w) => w.inboxId),
        );

        await newGroup.sync();
        const members = await newGroup.members();
        const totalLength = i + workers.getWorkers().length;
        expect(members.length).toEqual(totalLength);
        console.log(`Group created with ${totalLength} participants`);
      } catch (e) {
        hasFailures = logError(e, expect.getState().currentTestName);
        throw e;
      }
    });

    it(`receiveLargeGroupMessage-${i}: should create a group and measure all streams`, async () => {
      try {
        const verifyResult = await verifyMessageStream(
          newGroup,
          workers.getWorkers(),
        );
        console.log("verifyResult", JSON.stringify(verifyResult));
        expect(verifyResult.messages.length).toEqual(
          workers.getWorkers().length - 1,
        );
        expect(verifyResult.allReceived).toBe(true);
      } catch (e) {
        hasFailures = logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
