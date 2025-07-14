import {
  verifyAddMemberStream,
  verifyConsentStream,
  verifyConversationStream,
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { type Dm, type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "streams";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  let group: Group;
  let workers = await getWorkers(5);

  // Setup test lifecycle

  // it("membership stream", async () => {
  //   // Initialize workers
  //   group = await workers.createGroupBetweenAll();

  //   const verifyResult = await verifyMembershipStream(
  //     group,
  //     workers.getAllButCreator(),
  //     getInboxIds(1),
  //   );

  //   expect(verifyResult.allReceived).toBe(true);
  // });

  // it("consent stream", async () => {
  //   const verifyResult = await verifyConsentStream(
  //     workers.getCreator(),
  //     workers.getReceiver(),
  //   );

  //   expect(verifyResult.allReceived).toBe(true);
  // });

  // it("dm stream", async () => {
  //   // Create direct message
  //   const creator = workers.getCreator();
  //   const receiver = workers.getReceiver();
  //   const newDm = await creator.client.conversations.newDm(
  //     receiver.client.inboxId,
  //   );

  //   // Verify message delivery
  //   const verifyResult = await verifyMessageStream(newDm as Dm, [receiver], 10);

  //   expect(verifyResult.allReceived).toBe(true);
  // });

  // it("add member stream", async () => {
  //   const creator = workers.getCreator();
  //   const receiver = workers.getReceiver();
  //   // Create group with alice as the creator
  //   group = (await creator.client.conversations.newGroup([
  //     receiver.client.inboxId,
  //   ])) as Group;
  //   console.log("Group created", group.id);

  //   const addMembers = getInboxIds(1);
  //   const verifyResult = await verifyAddMemberStream(
  //     group,
  //     [receiver],
  //     addMembers,
  //   );
  //   expect(verifyResult.allReceived).toBe(true);
  // });

  // it("message stream", async () => {
  //   const newGroup = await workers.createGroupBetweenAll();

  //   // Verify message delivery
  //   const verifyResult = await verifyMessageStream(
  //     newGroup,
  //     workers.getAllButCreator(),
  //     10,
  //   );

  //   expect(verifyResult.allReceived).toBe(true);
  // });

  // it("metadata stream", async () => {
  //   // Initialize workers
  //   group = await workers.createGroupBetweenAll();

  //   const verifyResult = await verifyMetadataStream(
  //     group,
  //     workers.getAllButCreator(),
  //   );

  //   expect(verifyResult.allReceived).toBe(true);
  // });

  // it("conversation stream", async () => {
  //   // Use the dedicated conversation stream verification helper
  //   const verifyResult = await verifyConversationStream(workers.getCreator(), [
  //     workers.getReceiver(),
  //   ]);

  //   expect(verifyResult.allReceived).toBe(true);
  // });
});
