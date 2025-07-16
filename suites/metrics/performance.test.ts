import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getAddresses, getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { Client, IdentifierKind, type Dm, type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "performance";
describe(testName, async () => {
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [5, 10];
  let dm: Dm | undefined;
  let workers = await getWorkers(10);

  let newGroup: Group;
  const creator = workers.getCreator();
  const creatorClient = creator.client;
  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
    sendMetrics: true,
    sendDurationMetrics: true,
    networkStats: true,
  });

  it("clientCreate: should measure creating a client", async () => {
    const client = await getWorkers(["randomclient"]);
    expect(client).toBeDefined();
  });
  it("canMessage: should measure canMessage", async () => {
    const client = await getWorkers(["randomclient"]);
    if (!client) {
      throw new Error("Client not found");
    }

    const randomAddress = client.get("randomclient")!.address;
    if (!randomAddress) {
      throw new Error("Random client not found");
    }
    const start = Date.now();
    const canMessage = await Client.canMessage(
      [
        {
          identifier: randomAddress,
          identifierKind: IdentifierKind.Ethereum,
        },
      ],
      client.get("randomclient")!.env,
    );
    setCustomDuration(Date.now() - start);
    expect(canMessage.get(randomAddress.toLowerCase())).toBe(true);
  });

  it("inboxState: should measure inboxState", async () => {
    const inboxState = await creatorClient.preferences.inboxState(true);
    expect(inboxState.installations.length).toBeGreaterThan(0);
  });
  it("newDm: should measure creating a DM", async () => {
    dm = (await creatorClient.conversations.newDm(
      workers.getAll()[1].client.inboxId,
    )) as Dm;
    expect(dm).toBeDefined();
    expect(dm.id).toBeDefined();
  });
  it("newDmWithIdentifiers: should measure creating a DM", async () => {
    const dm2 = await creatorClient.conversations.newDmWithIdentifier({
      identifier: workers.getAll()[2].address,
      identifierKind: IdentifierKind.Ethereum,
    });

    expect(dm2).toBeDefined();
    expect(dm2.id).toBeDefined();
  });

  it("sendGM: should measure sending a gm", async () => {
    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    const dmId = await dm!.send(message);

    expect(dmId).toBeDefined();
  });

  it("receiveGM: should measure receiving a gm", async () => {
    const verifyResult = await verifyMessageStream(dm!, [workers.getAll()[1]]);
    setCustomDuration(verifyResult.averageEventTiming);
    expect(verifyResult.almostAllReceived).toBe(true);
  });

  for (const i of BATCH_SIZE) {
    it(`newGroup-${i}: should create a large group of ${i} participants ${i}`, async () => {
      const sliced = getInboxIds(i);
      newGroup = (await creatorClient.conversations.newGroup([
        ...sliced,
        ...workers.getAll().map((w) => w.client.inboxId),
      ])) as Group;
      expect(newGroup.id).toBeDefined();
    });
    it(`newGroupByIdentifiers-${i}: should create a large group of ${i} participants ${i}`, async () => {
      const sliced = getAddresses(i);
      const newGroupByIdentifier =
        await creatorClient.conversations.newGroupWithIdentifiers(
          sliced.map((address) => ({
            identifier: address,
            identifierKind: IdentifierKind.Ethereum,
          })),
        );
      expect(newGroupByIdentifier.id).toBeDefined();
    });
    it(`sync-${i}: should sync a large group of ${i} participants ${i}`, async () => {
      await newGroup.sync();
      const members = await newGroup.members();
      expect(members.length).toBe(members.length);
    });
    it(`updateGroupName-${i}: should update the group name`, async () => {
      const newName = "Large Group";
      await newGroup.updateName(newName);
      await newGroup.sync();
      const name = newGroup.name;
      expect(name).toBe(newName);
    });
    it(`sendGroupMessage-${i}: should measure sending a gm in a group of ${i} participants`, async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      await newGroup.send(groupMessage);
      expect(groupMessage).toBeDefined();
    });
    it(`verifyGroupMessage-${i}: should verify group message`, async () => {
      const verifyResult = await verifyMessageStream(
        newGroup,
        workers.getAllButCreator(),
      );
      setCustomDuration(verifyResult?.averageEventTiming ?? 0);
      expect(verifyResult.allReceived).toBe(true);
    });
    it(`addMember-${i}: should add members to a group`, async () => {
      await newGroup.addMembers([workers.getAll()[2].inboxId]);
    });
    it(`removeMembers-${i}: should remove a participant from a group`, async () => {
      const previousMembers = await newGroup.members();
      await newGroup.removeMembers([
        previousMembers.filter(
          (member) => member.inboxId !== newGroup.addedByInboxId,
        )[0].inboxId,
      ]);

      const members = await newGroup.members();
      expect(members.length).toBe(previousMembers.length - 1);
    });
  }
});
