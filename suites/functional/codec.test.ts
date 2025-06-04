import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  ContentTypeReaction,
  type Reaction,
} from "@xmtp/content-type-reaction";
import { loadEnv } from "dev/helpers/client";
import { getFixedNames } from "dev/helpers/utils";
import { setupTestLifecycle } from "dev/helpers/vitest";
import { describe, expect, it } from "vitest";

const testName = "codec";
loadEnv(testName);

describe(testName, async () => {
  let workers: WorkerManager;
  workers = await getWorkers(getFixedNames(2), testName);

  setupTestLifecycle({ expect });
  it("codec: should trigger a stream error", async () => {
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

      await convo.send(reaction as unknown as string, ContentTypeReaction);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});
