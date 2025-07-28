import {
  verifyAddMemberStream,
  verifyConsentStream,
  verifyConversationStream,
  verifyGroupConsentStream,
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { type Dm, type Group } from "@workers/versions";
import {
  ContentTypeReaction,
  type Reaction,
} from "@xmtp/content-type-reaction";
import { describe, expect, it } from "vitest";

const testName = "streams";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  let group: Group;
  let workers = await getWorkers(5);
  it("conversations: new conversation stream", async () => {
    const verifyResult = await verifyConversationStream(workers.getCreator(), [
      workers.getReceiver(),
    ]);
    expect(verifyResult.allReceived).toBe(true);
  });
  it("membership: member addition stream", async () => {
    group = await workers.createGroupBetweenAll();
    const verifyResult = await verifyMembershipStream(
      group,
      workers.getAllButCreator(),
      getInboxIds(1),
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("consent: consent state changes for direct messages", async () => {
    const verifyResult = await verifyConsentStream(
      workers.getCreator(),
      workers.getReceiver(),
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("consent: consent state changes in groups", async () => {
    group = await workers.createGroupBetweenAll();
    const verifyResult = await verifyGroupConsentStream(
      group,
      workers.getAllButCreator(),
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("messages: direct message delivery", async () => {
    const creator = workers.getCreator();
    const receiver = workers.getReceiver();
    const newDm = await creator.client.conversations.newDm(
      receiver.client.inboxId,
    );
    const verifyResult = await verifyMessageStream(newDm as Dm, [receiver], 10);
    expect(verifyResult.allReceived).toBe(true);
  });

  it("messages: group message delivery", async () => {
    const newGroup = await workers.createGroupBetweenAll();
    const verifyResult = await verifyMessageStream(
      newGroup,
      workers.getAllButCreator(),
      10,
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("metadata: group metadata updates", async () => {
    group = await workers.createGroupBetweenAll();
    const verifyResult = await verifyMetadataStream(
      group,
      workers.getAllButCreator(),
    );
    expect(verifyResult.allReceived).toBe(true);
  });

  it("members: member addition to existing group", async () => {
    const creator = workers.getCreator();
    const receiver = workers.getReceiver();
    group = (await creator.client.conversations.newGroup([
      receiver.client.inboxId,
    ])) as Group;
    const addMembers = getInboxIds(1);
    const verifyResult = await verifyAddMemberStream(
      group,
      [receiver],
      addMembers,
    );
    expect(verifyResult.allReceived).toBe(true);
  });
  it("codec: handle codec errors gracefully when sending unsupported content types", async () => {
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
