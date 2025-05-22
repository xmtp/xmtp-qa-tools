import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { getAddresses, getInboxIds, getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  Client,
  IdentifierKind,
  type Conversation,
  type Group,
} from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "m_performance";
loadEnv(testName);

describe(testName, async () => {
  const batchSize = parseInt(process.env.BATCH_SIZE ?? "5");
  const total = parseInt(process.env.MAX_GROUP_SIZE ?? "10");
  console.log(`[${testName}] Batch size: ${batchSize}, Total: ${total}`);
  let dm: Conversation;
  let workers: WorkerManager;

  workers = await getWorkers(
    getRandomNames(10),
    testName,
    typeofStream.Message,
  );

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
    expect,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
  });

  it("clientCreate: should measure creating a client", async () => {
    try {
      const client = await getWorkers(["randomclient"], testName);
      expect(client).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it("canMessage: should measure canMessage", async () => {
    try {
      const client = await getWorkers(["randomclient"], testName);
      if (!client) {
        throw new Error("Client not found");
      }

      const randomAddress = client.get("randomclient")!.address;
      if (!randomAddress) {
        throw new Error("Random client not found");
      }
      const canMessage = await Client.canMessage(
        [
          {
            identifier: randomAddress,
            identifierKind: IdentifierKind.Ethereum,
          },
        ],
        client.get("randomclient")!.env,
      );
      expect(canMessage.get(randomAddress.toLowerCase())).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it("inboxState: should measure inboxState", async () => {
    try {
      const inboxState = await workers
        .getCreator()
        .client.preferences.inboxState(true);
      expect(inboxState.installations.length).toBeGreaterThan(0);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it("newDm: should measure creating a DM", async () => {
    try {
      dm = await workers
        .getCreator()
        .client.conversations.newDm(workers.getAll()[1].client.inboxId);

      expect(dm).toBeDefined();
      expect(dm.id).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it("newDmWithIdentifiers: should measure creating a DM", async () => {
    try {
      const dm2 = await workers
        .getCreator()
        .client.conversations.newDmWithIdentifier({
          identifier: workers.getAll()[2].address,
          identifierKind: IdentifierKind.Ethereum,
        });

      expect(dm2).toBeDefined();
      expect(dm2.id).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("sendGM: should measure sending a gm", async () => {
    try {
      // We'll expect this random message to appear in Joe's stream
      const message = "gm-" + Math.random().toString(36).substring(2, 15);

      const dmId = await dm.send(message);

      expect(dmId).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("receiveGM: should measure receiving a gm", async () => {
    try {
      const verifyResult = await verifyMessageStream(dm, [workers.getAll()[1]]);
      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  let i = 4;
  let newGroup: Conversation;
  it(`createGroup: should create a large group of ${i} participants ${i}`, async () => {
    try {
      const sliced = getInboxIds(i);
      newGroup = await workers
        .getCreator()
        .client.conversations.newGroup([
          ...sliced,
          ...workers.getAll().map((w) => w.client.inboxId),
        ]);
      console.log("New group created", newGroup.id);
      expect(newGroup.id).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it(`createGroupByIdentifiers: should create a large group of ${i} participants ${i}`, async () => {
    try {
      const sliced = getAddresses(i);
      const newGroupByIdentifier = await workers
        .getCreator()
        .client.conversations.newGroupWithIdentifiers(
          sliced.map((address) => ({
            identifier: address,
            identifierKind: IdentifierKind.Ethereum,
          })),
        );
      expect(newGroupByIdentifier.id).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it(`syncGroup: should sync a large group of ${i} participants ${i}`, async () => {
    try {
      await newGroup.sync();
      const members = await newGroup.members();
      expect(members.length).toBe(members.length);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it(`updateGroupName: should update the group name`, async () => {
    try {
      const newName = "Large Group";
      await (newGroup as Group).updateName(newName);
      await newGroup.sync();
      const name = (newGroup as Group).name;
      expect(name).toBe(newName);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it(`sendGroupMessage: should measure sending a gm in a group of ${i} participants`, async () => {
    try {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      await newGroup.send(groupMessage);
      expect(groupMessage).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it(`receiveGroupMessage: should measure receiving a gm in a group of ${i} participants`, async () => {
    try {
      const verifyResult = await verifyMessageStream(
        newGroup,
        workers.getAllButCreator(),
      );
      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it(`addMembers: should add members to a group`, async () => {
    try {
      await (newGroup as Group).addMembers([workers.getAll()[2].inboxId]);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it(`removeMembers: should remove a participant from a group`, async () => {
    try {
      const previousMembers = await newGroup.members();
      await (newGroup as Group).removeMembers([
        previousMembers.filter(
          (member) => member.inboxId !== (newGroup as Group).addedByInboxId,
        )[0].inboxId,
      ]);

      const members = await newGroup.members();
      expect(members.length).toBe(previousMembers.length - 1);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  for (let i = batchSize; i <= total; i += batchSize) {
    let newGroup: Conversation;
    it(`createGroup-${i}: should create a large group of ${i} participants ${i}`, async () => {
      try {
        const sliced = getInboxIds(i);
        newGroup = await workers
          .getCreator()
          .client.conversations.newGroup([
            ...sliced,
            ...workers.getAll().map((w) => w.client.inboxId),
          ]);
        expect(newGroup.id).toBeDefined();
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
    it(`createGroupByIdentifiers-${i}: should create a large group of ${i} participants ${i}`, async () => {
      try {
        const sliced = getAddresses(i);
        const newGroupByIdentifier = await workers
          .getCreator()
          .client.conversations.newGroupWithIdentifiers(
            sliced.map((address) => ({
              identifier: address,
              identifierKind: IdentifierKind.Ethereum,
            })),
          );
        expect(newGroupByIdentifier.id).toBeDefined();
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
    it(`syncGroup-${i}: should sync a large group of ${i} participants ${i}`, async () => {
      try {
        await newGroup.sync();
        const members = await newGroup.members();
        expect(members.length).toBe(members.length);
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
    it(`updateGroupName-${i}: should update the group name`, async () => {
      try {
        const newName = "Large Group";
        await (newGroup as Group).updateName(newName);
        await newGroup.sync();
        const name = (newGroup as Group).name;
        expect(name).toBe(newName);
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
    it(`removeMembers-${i}: should remove a participant from a group`, async () => {
      try {
        const previousMembers = await newGroup.members();
        await (newGroup as Group).removeMembers([
          previousMembers.filter(
            (member) => member.inboxId !== (newGroup as Group).addedByInboxId,
          )[0].inboxId,
        ]);

        const members = await newGroup.members();
        expect(members.length).toBe(previousMembers.length - 1);
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
    it(`sendGroupMessage-${i}: should measure sending a gm in a group of ${i} participants`, async () => {
      try {
        const groupMessage =
          "gm-" + Math.random().toString(36).substring(2, 15);

        await newGroup.send(groupMessage);
        expect(groupMessage).toBeDefined();
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
    it(`receiveGroupMessage-${i}: should create a group and measure all streams`, async () => {
      try {
        const verifyResult = await verifyMessageStream(
          newGroup,
          workers.getAllButCreator(),
        );
        setCustomDuration(verifyResult.averageEventTiming);
        expect(verifyResult.allReceived).toBe(true);
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
