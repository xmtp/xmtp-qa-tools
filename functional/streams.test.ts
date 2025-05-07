import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyStream, verifyStreamAll } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/tests";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "streams";
loadEnv(testName);

describe(testName, async () => {
  let hasFailures: boolean = false;
  let start: number;
  let testStart: number;
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

  it("receiveGM: should measure receiving a gm", async () => {
    try {
      const convo = await workers
        .get("henry")!
        .client.conversations.newDm(workers.get("randomguy")!.client.inboxId);

      const verifyResult = await verifyStream(
        convo,
        [workers.get("randomguy")!],
        "text",
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
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it(`receiveGroupMessage: should create a group and measure all streams`, async () => {
    try {
      const convo = await workers
        .get("henry")!
        .client.conversations.newGroup([
          workers.get("randomguy")!.client.inboxId,
          workers.get("bob")!.client.inboxId,
          workers.get("alice")!.client.inboxId,
          workers.get("dave")!.client.inboxId,
        ]);

      const verifyResult = await verifyStreamAll(convo, workers, 1, () => {
        console.log("Group message sent, starting timer now");
        start = performance.now();
      });

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });
});
