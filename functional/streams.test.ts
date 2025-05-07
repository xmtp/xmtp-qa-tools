import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyStream, verifyStreamAll } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import type { Conversation, Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "streams";
loadEnv(testName);

describe(testName, async () => {
  let hasFailures: boolean = false;
  let start: number;
  let testStart: number;
  let group: Group;
  const workers = await getWorkers(
    ["henry", "bob", "alice", "dave", "randomguy"],
    testName,
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
  beforeAll(async () => {
    group = await workers
      .get("henry")!
      .client.conversations.newGroup([
        workers.get("randomguy")!.client.inboxId,
        workers.get("bob")!.client.inboxId,
        workers.get("alice")!.client.inboxId,
        workers.get("dave")!.client.inboxId,
      ]);
  });

  it("receiveGM: should measure receiving a gm", async () => {
    try {
      const newDm = await workers
        .get("henry")!
        .client.conversations.newDm(workers.get("randomguy")!.client.inboxId);

      const verifyResult = await verifyStream(
        newDm,
        [workers.get("randomguy")!],
        typeofStream.Message,
        1,
        undefined,
        undefined,
        () => {
          console.log("DM message sent, starting timer now");
          start = performance.now();
        },
      );

      expect(verifyResult.messages.length).toEqual(1);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it(`receiveGroupMessage: should create a group and measure all streams`, async () => {
    try {
      const verifyResult = await verifyStreamAll(group, workers, 1, () => {
        console.log("Group message sent, starting timer now");
        start = performance.now();
      });

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("receiveGroupMetadata: should update group name", async () => {
    const verifyResult = await verifyStream(
      group,
      [workers.get("henry")!],
      typeofStream.GroupUpdated,
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("receiveGroupConsent: should update group name", async () => {
    const verifyResult = await verifyStream(
      group,
      [workers.get("henry")!],
      typeofStream.Consent,
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("receiveGroupConversation: should update group name", async () => {
    const verifyResult = await verifyStream(
      group,
      [workers.get("henry")!],
      typeofStream.Conversation,
    );
    expect(verifyResult.allReceived).toBe(true);
  });
});
