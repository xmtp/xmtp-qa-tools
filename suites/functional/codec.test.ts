import { getFixedNames } from "@helpers/client";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  ContentTypeReaction,
  type Reaction,
} from "@xmtp/content-type-reaction";
import { describe, expect, it } from "vitest";

const testName = "codec";

describe(testName, async () => {
  let workers: WorkerManager;
  workers = await getWorkers(getFixedNames(2), testName);

  setupTestLifecycle({
    testName,
    expect,
  });

  it("should handle codec errors gracefully when sending unsupported content types", async () => {
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
