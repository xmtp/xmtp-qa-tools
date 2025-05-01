import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  ContentTypeReaction,
  type Reaction,
} from "@xmtp/content-type-reaction";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "stream-error";

describe(testName, () => {
  loadEnv(testName);
  let workers: WorkerManager;

  beforeAll(async () => {
    try {
      workers = await getWorkers(["henry", "ivy"], testName);
      expect(workers).toBeDefined();
      expect(workers.getLength()).toBe(2);
    } catch (e) {
      logError(e, expect);
      throw e;
    }
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
