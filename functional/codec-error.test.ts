import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/tests";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  ContentTypeReaction,
  type Reaction,
} from "@xmtp/content-type-reaction";
import { describe, expect, it } from "vitest";

const testName = "stream-error";
loadEnv(testName);

describe(testName, async () => {
  let workers: WorkerManager;
  workers = await getWorkers(["henry", "ivy"], testName);

  let hasFailures: boolean = false;
  let start: number;
  let testStart: number;

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

  it("forceStreamError: should measure force a stream error", async () => {
    try {
      const henry = workers.get("henry")!;
      const ivy = workers.get("ivy")!;
      const convo = await henry.client.conversations.newDm(ivy.client.inboxId);
      const reaction: Reaction = {
        action: "added",
        content: "smile",
        reference: "originalMessage",
        schema: "shortcode",
      };

      await convo.send(reaction, ContentTypeReaction);
    } catch (e) {
      expect(e).toBeDefined();
      logError(e, expect);
    }
  });
});
