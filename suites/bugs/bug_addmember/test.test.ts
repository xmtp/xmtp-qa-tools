import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyAddMemberStream } from "@helpers/streams";
import { getInboxIds } from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "bug_addmember";
loadEnv(testName);

describe(testName, async () => {
  const workers = await getWorkers(["bob"], testName);
  const receiverWorkers = await getWorkers(
    ["alice"],
    testName,
    typeofStream.Conversation,
    typeOfResponse.None,
    typeOfSync.None,
  );
  let creator = workers.get("bob")!;
  let receiver = receiverWorkers.get("alice")!;

  let group: Group;

  setupTestLifecycle({
    expect,
  });

  it("should create a group", async () => {
    try {
      // Create group with alice as the creator
      group = (await creator.client.conversations.newGroup(
        getInboxIds(2),
      )) as Group;
      console.log("Group created", group.id);

      // Verify that the membership stream works correctly
      const verifyResult = await verifyAddMemberStream(
        group,
        [receiver],
        [receiver.client.inboxId],
      );

      expect(verifyResult.allReceived).toBe(true);
      console.log("Membership stream verification passed");
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
