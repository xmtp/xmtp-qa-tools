import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
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

  setupTestLifecycle({
    expect,
  });
  it("codec-error: should measure force a stream error", async () => {
    try {
      const creator = workers.getCreator();
      const receiver = workers.getReceiver();
      const convo = await creator.client.conversations.newDm(
        receiver.client.inboxId,
      );
      const reaction: Reaction = {
        action: "added",
        content: "smile",
        reference: "originalMessage",
        schema: "shortcode",
      };

      const result = await convo.send(reaction, ContentTypeReaction);
      expect(result).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
