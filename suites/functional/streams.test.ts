import { logError } from "@helpers/logger";
import { verifyAddMemberStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

describe("streams", async () => {
  let group: Group;
  let workers = await getWorkers(5);

  // Setup test lifecycle
  setupTestLifecycle({});

  it("should stream real-time notifications when new members are added to groups", async () => {
    try {
      const creator = workers.getCreator();
      const receiver = workers.getReceiver();
      // Create group with alice as the creator
      group = (await creator.client.conversations.newGroup([
        receiver.client.inboxId,
      ])) as Group;
      console.log("Group created", group.id);

      const addMembers = getInboxIds(1);
      const verifyResult = await verifyAddMemberStream(
        group,
        [receiver],
        addMembers,
      );
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
