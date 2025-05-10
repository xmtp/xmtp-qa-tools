import { loadEnv } from "@helpers/client";
import { getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
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
  workers = await getWorkers(getRandomNames(2), testName);

  let start: number;
  let testStart: number;

  setupTestLifecycle({
    expect,
    workers,
    testName,
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
      const creator = workers.getWorkers()[0];
      const receiver = workers.getWorkers()[1];
      const convo = await creator.client.conversations.newDm(
        receiver.client.inboxId,
      );
      const reaction: Reaction = {
        action: "added",
        content: "smile",
        reference: "originalMessage",
        schema: "shortcode",
      };

      await convo.send(reaction, ContentTypeReaction);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});
