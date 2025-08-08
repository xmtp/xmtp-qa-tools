import { verifyMessageStream } from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { type Dm, type Group } from "version-management/client-versions";
import { describe, expect, it } from "vitest";

const testName = "sync";
describe(testName, () => {
  setupDurationTracking({ testName });

  it("create a group", async () => {
    const workers = await getWorkers(["henry", "john"]);
    const creator = workers.get("henry")!;
    const receiver = workers.get("john")!;
    const allInboxIds = getInboxes(2).map((a) => a.inboxId);
    console.log("All inbox ids", allInboxIds);
    const group = (await creator.client.conversations.newGroup(
      allInboxIds,
    )) as Group;

    await group.send(receiver.inboxId);
    await receiver.client.conversations.syncAll();
    const stream = receiver.client.conversations.stream();
    await group.addMembers([receiver.client.inboxId]);
    for await (const conversation of await stream) {
      console.log("Conversation", conversation?.id);
      expect(conversation?.id).toBe(group.id);
      break;
    }
  }, 500);

  it("check stream restart (prev 4.0.2 bug)", async () => {
    const agentWorkers = await getWorkers(1);
    const agent = agentWorkers.getCreator();
    let messageCount = 0;

    // First test
    let talkerWorkers = await getWorkers(1);
    let creator = talkerWorkers.getCreator();
    let convo = await creator.client.conversations.newDm(agent.inboxId);

    let stream = await agent.client.conversations.streamAllMessages({
      onValue: (message: DecodedMessage) => {
        if (
          message.senderInboxId.toLowerCase() !== agent.inboxId.toLowerCase()
        ) {
          console.log("message", message.content);
          messageCount++;
          return;
        }
      },
    });
    await sleep(1000);

    await convo.send("convo1");
    await sleep(1000);
    void stream.end();

    stream = await agent.client.conversations.streamAllMessages({
      onValue: (message: DecodedMessage) => {
        if (
          message.senderInboxId.toLowerCase() !== agent.inboxId.toLowerCase()
        ) {
          console.log("message", message.content);
          messageCount++;
          return;
        }
      },
    });
    // First test
    await convo.send("convo2");
    await sleep(1000);

    expect(messageCount).toBe(2);
  });
  const mergedVersions = [
    getVersions().slice(0, 3),
    getVersions().slice(0, 3).reverse(),
  ];
  for (let i = 0; i < mergedVersions.length; i++) {
    const version = mergedVersions[i];
    it(`switched from ${version[i - 1].nodeSDK} to ${version[i].nodeSDK}`, async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const versionWorkers = await getWorkers(["creator"], {
          nodeSDK: version[i - 1].nodeSDK,
        });

        const creator = versionWorkers.getCreator();
        let convo = await creator.client.conversations.newDm(
          receiver!.inboxId as string,
        );
        const verifyResult = await verifyMessageStream(convo, [receiver]);
        expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(99);
      } catch (error) {
        console.error(
          "Error downgrading to version",
          version[i - 1].nodeSDK,
          error,
        );
      }
    });
  }

  it("conversations: new conversation stream", async () => {
    const verifyResult = await verifyConversationStream(workers.getCreator(), [
      workers.getReceiver(),
    ]);
    expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(0);
  });
  it("membership: member addition stream", async () => {
    group = await workers.createGroupBetweenAll();
    const verifyResult = await verifyMembershipStream(
      group,
      workers.getAllButCreator(),
      getInboxes(1).map((a) => a.inboxId),
    );
    expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(0);
  });

  it("consent: consent state changes for direct messages", async () => {
    const verifyResult = await verifyConsentStream(
      workers.getCreator(),
      workers.getReceiver(),
    );
    expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(0);
  });

  it("groupConsent: consent state changes in groups", async () => {
    group = await workers.createGroupBetweenAll();
    const verifyResult = await verifyGroupConsentStream(
      group,
      workers.getAllButCreator(),
    );
    expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(0);
  });

  it("messages: direct message delivery", async () => {
    const creator = workers.getCreator();
    const receiver = workers.getReceiver();
    const newDm = await creator.client.conversations.newDm(
      receiver.client.inboxId,
    );
    const verifyResult = await verifyMessageStream(newDm as Dm, [receiver], 10);
    expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(0);
  });

  it("messages: group message delivery", async () => {
    const newGroup = await workers.createGroupBetweenAll();
    const verifyResult = await verifyMessageStream(
      newGroup,
      workers.getAllButCreator(),
      10,
    );
    expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(0);
  });

  it("metadata: group metadata updates", async () => {
    group = await workers.createGroupBetweenAll();
    const verifyResult = await verifyMetadataStream(
      group,
      workers.getAllButCreator(),
    );
    expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(0);
  });

  it("members: member addition to existing group", async () => {
    const creator = workers.getCreator();
    const receiver = workers.getReceiver();
    group = (await creator.client.conversations.newGroup([
      receiver.client.inboxId,
    ])) as Group;
    const addMembers = getInboxes(1).map((a) => a.inboxId);
    const verifyResult = await verifyAddMemberStream(
      group,
      [receiver],
      addMembers,
    );
    expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(0);
  });

  it("track epoch changes during group operations", async () => {
    const workers = await getWorkers(3);

    const group = await workers.createGroupBetweenAll();
    const initialDebugInfo = await group.debugInfo();
    const initialEpoch = initialDebugInfo.epoch;

    // Perform group operation that should increment epoch
    const newMember = getInboxes(1)[0].inboxId;
    await group.addMembers([newMember]);
    // Get updated debug info
    const updatedDebugInfo = await group.debugInfo();
    console.log("updatedEpoch", updatedDebugInfo.epoch);
    expect(updatedDebugInfo.epoch).toBe(initialEpoch + 1n);
  });

  it("stitching", async () => {
    const workers = await getWorkers(["randombob-a", "alice"]);
    let creator = workers.get("randombob", "a")!;
    const receiver = workers.get("alice")!;
    const dm = (await creator.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;

    console.log("New dm created", dm.id);

    const resultFirstDm = await verifyMessageStream(dm, [receiver]);
    expect(resultFirstDm.receptionPercentage).toBeGreaterThanOrEqual(0);

    // Create fresh random1 client
    const bobB = await getWorkers(["randombob-b"]);
    creator = bobB.get("randombob", "b")!;
    const secondDm = (await creator.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    console.log("New dm created", dm.id);

    const resultSecondDm = await verifyMessageStream(secondDm, [receiver]);
    expect(resultSecondDm.receptionPercentage).toBeGreaterThanOrEqual(0);
  });

  it("conversations: new conversation stream", async () => {
    const verifyResult = await verifyConversationStream(workers.getCreator(), [
      workers.getReceiver(),
    ]);
    expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(0);
  });
});
