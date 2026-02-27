import { streamTimeout } from "@helpers/client";
import { sendTextCompat } from "@helpers/sdk-compat";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import {
  Client,
  ConsentEntityType,
  ConsentState,
  IdentifierKind,
  type Dm,
  type Group,
} from "@helpers/versions";
import { getInboxes, type InboxData } from "@inboxes/utils";
import {
  getRandomNames,
  getWorkers,
  type Worker,
  type WorkerManager,
} from "@workers/manager";
import { describe, expect, it } from "vitest";
import { setupSummaryTable } from "./helper";

const testName = "measure";
describe(testName, () => {
  const POPULATE_SIZE = process.env.POPULATE_SIZE
    ? process.env.POPULATE_SIZE.split("-").map((v) => Number(v))
    : [0, 1000, 2000, 5000];
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [10];
  const INSTALLATION_PER_MEMBER = process.env.INSTALLATION_PER_MEMBER
    ? process.env.INSTALLATION_PER_MEMBER.split("-").map((v) => Number(v))
    : [2];
  const MESSAGE_SYNC_COUNT = process.env.MESSAGE_SYNC_COUNT
    ? Number(process.env.MESSAGE_SYNC_COUNT)
    : 10;
  const randomNames = getRandomNames(5);
  let dm: Dm;

  let newGroup: Group;
  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };
  let allMembers: InboxData[] = [];
  let allMembersWithExtra: InboxData[] = [];
  let extraMember: InboxData;
  setupSummaryTable({
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v: number | undefined) => {
      customDuration = v;
    },
  });

  for (const populateSize of POPULATE_SIZE) {
    let workers: WorkerManager;
    let creator: Worker;
    let receiver: Worker;
    it(`create(${populateSize}): measure creating a client`, async () => {
      const workerNames = [...randomNames];
      let bysizeWorkerName = "";
      if (populateSize > 0) {
        bysizeWorkerName = `bysize${populateSize}`;
        workerNames.unshift(bysizeWorkerName);
      }
      workers = await getWorkers(workerNames);
      creator = workers.mustGet(workerNames[0]);
      receiver = workers.mustGet(workerNames[1]);

      setCustomDuration(creator.initializationTime);
    });
    it(`sync(${populateSize}):measure sync`, async () => {
      await creator.client.conversations.sync();
    });

    it(`syncAll(${populateSize}):measure syncAll`, async () => {
      await creator.client.conversations.syncAll();
    });

    it(`storage(${populateSize}):measure storage`, async () => {
      const storage = await creator.worker.getSQLiteFileSizes();
      expect(storage.dbFile).toBeDefined();
      setCustomDuration(storage.dbFile);
    });
    it(`inboxState(${populateSize}):measure inboxState`, async () => {
      const state = await creator.client.preferences.inboxState();
      expect(state).toBeDefined();
    });
    it(`setConsentStates:group consent`, async () => {
      await creator.client.preferences.setConsentStates([
        {
          entity: getInboxes(1)[0].inboxId,
          entityType: ConsentEntityType.InboxId,
          state: ConsentState.Allowed,
        },
      ]);
    });
    it(`canMessage(${populateSize}):measure canMessage`, async () => {
      const canMessage = await Client.canMessage(
        [
          {
            identifier: receiver.address,
            identifierKind: IdentifierKind.Ethereum,
          },
        ],
        receiver.env,
      );
      expect(canMessage.get(receiver.address.toLowerCase())).toBe(true);
    });

    it(`newDm(${populateSize}):measure creating a DM`, async () => {
      dm = (await creator.client.conversations.createDm(
        receiver.client.inboxId,
      )) as Dm;
      expect(dm).toBeDefined();
      expect(dm.id).toBeDefined();
    });
    it(`streamMessage(${populateSize}):measure receiving a gm`, async () => {
      const verifyResult = await verifyMessageStream(dm, [receiver]);
      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(99);
    });

    it(`getConversationById(${populateSize}):measure getting a conversation by id`, async () => {
      const conversation =
        await creator.client.conversations.getConversationById(dm.id);
      expect(conversation!.id).toBe(dm.id);
    });
    it(`send(${populateSize}):measure sending a gm`, async () => {
      const dmId = await sendTextCompat(dm, "gm");
      expect(dmId).toBeDefined();
    });

    for (const i of BATCH_SIZE) {
      for (const installationPerMember of INSTALLATION_PER_MEMBER) {
        it(`newGroup-${i}:create a large group of ${i} members ${i}`, async () => {
          allMembersWithExtra = getInboxes(i - workers.getAll().length + 2);
          allMembers = allMembersWithExtra.slice(
            0,
            allMembersWithExtra.length - 2,
          );
          extraMember = allMembersWithExtra.at(-1)!;
          newGroup = (await creator.worker.createGroupWithIdentifiers([
            ...allMembers.map((a) => ({
              identifier: a.accountAddress,
              identifierKind: IdentifierKind.Ethereum,
            })),
            ...workers.getAllButCreator().map((w) => ({
              identifier: w.address,
              identifierKind: IdentifierKind.Ethereum,
            })),
          ])) as Group;
          const members = await newGroup.members();
          // Some identifier-based members may not resolve; require at least 80% success
          expect(members.length).toBeGreaterThanOrEqual(Math.ceil(i * 0.8));
          expect(newGroup.id).toBeDefined();
          if (!newGroup.id) {
            throw new Error("Group ID is undefined, cancelling the test");
          }
        });
        it(`groupsync-${i}(${populateSize})[${installationPerMember}]:sync ${MESSAGE_SYNC_COUNT} messages as group member`, async () => {
          // 1. Send MESSAGE_SYNC_COUNT messages to the group from creator
          for (let msgIdx = 0; msgIdx < MESSAGE_SYNC_COUNT; msgIdx++) {
            await sendTextCompat(
              newGroup,
              `history-msg-${msgIdx}-${Math.random().toString(36).substring(2, 8)}`,
            );
          }

          // 2. Get receiver's view of the group (receiver is already a member but hasn't synced yet)
          await receiver.client.conversations.sync();
          const receiverGroup =
            await receiver.client.conversations.getConversationById(
              newGroup.id,
            );
          expect(receiverGroup).toBeDefined();

          // 3. Measure sync time for message history
          const syncStart = performance.now();
          await receiverGroup!.sync();
          const messages = await receiverGroup!.messages();
          const syncDuration = performance.now() - syncStart;

          setCustomDuration(syncDuration);

          // Verify we got the messages (at least MESSAGE_SYNC_COUNT)
          expect(messages.length).toBeGreaterThanOrEqual(MESSAGE_SYNC_COUNT);
        });

        it(`updateName-${i}(${populateSize})[${installationPerMember}]:update the group name`, async () => {
          const newName = "Large Group";
          await newGroup.updateName(newName);
          // Verify from a different worker's perspective (receiver)
          await receiver.client.conversations.sync();
          const receiverConvo =
            await receiver.client.conversations.getConversationById(
              newGroup.id,
            );
          await receiverConvo!.sync();
          expect((receiverConvo as Group).name).toBe(newName);
        });
        it(`send-${i}(${populateSize})[${installationPerMember}]:measure sending a gm in a group of ${i} members`, async () => {
          const groupMessage =
            "gm-" + Math.random().toString(36).substring(2, 15);

          const sendResult = await sendTextCompat(newGroup, groupMessage);
          expect(sendResult).toBeDefined();
        });
        it(`addAdmin-${i}(${populateSize})[${installationPerMember}]:add an admin to a group`, async () => {
          await newGroup.addAdmin(receiver.client.inboxId);
          await newGroup.sync();
          const members = await newGroup.members();
          const receiverMember = members.find(
            (m: any) => m.inboxId === receiver.client.inboxId,
          );
          expect(receiverMember).toBeDefined();
        });
        it(
          `streamMembership-${i}(${populateSize})[${installationPerMember}]: new member added to group`,
          async () => {
            await receiver.client.conversations.sync();
            const groupByReceiver =
              await receiver.client.conversations.getConversationById(
                newGroup.id,
              );
            const verifyResult = await verifyMembershipStream(
              groupByReceiver as Group,
              [creator],
              [extraMember.inboxId],
            );

            setCustomDuration(verifyResult.averageEventTiming);
            expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(90);
          },
          streamTimeout * 5,
        );
        it(`removeMembers-${i}(${populateSize})[${installationPerMember}]:remove a participant from a group`, async () => {
          const membersBefore = await newGroup.members();
          const countBefore = membersBefore.length;
          await newGroup.removeMembers([extraMember.inboxId]);
          const membersAfter = await newGroup.members();
          expect(membersAfter.length).toBe(countBefore - 1);
        });
        it(`addMember-${i}(${populateSize})[${installationPerMember}]:add members to a group`, async () => {
          const membersBefore = await newGroup.members();
          const countBefore = membersBefore.length;
          await newGroup.addMembers([extraMember.inboxId]);
          const membersAfter = await newGroup.members();
          expect(membersAfter.length).toBe(countBefore + 1);
        });
        it(
          `streamMessage-${i}(${populateSize})[${installationPerMember}]: stream members of message changes in ${i} member group`,
          async () => {
            await receiver.client.conversations.sync();
            const groupByReceiver =
              await receiver.client.conversations.getConversationById(
                newGroup.id,
              );
            console.log("groupByReceiver", groupByReceiver?.id);
            const verifyResult = await verifyMessageStream(
              groupByReceiver as Group,
              [creator],
            );

            setCustomDuration(verifyResult.averageEventTiming);
            expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(90);
          },
          streamTimeout * 5,
        );

        it(
          `streamMetadata-${i}(${populateSize})[${installationPerMember}]: stream members of metadata changes in ${i} member group`,
          async () => {
            await receiver.client.conversations.sync();
            const groupByReceiver =
              await receiver.client.conversations.getConversationById(
                newGroup.id,
              );
            console.log("groupByReceiver", groupByReceiver?.id);
            const verifyResult = await verifyMetadataStream(
              groupByReceiver as Group,
              [creator],
            );

            setCustomDuration(verifyResult.averageEventTiming);
            expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(90);
          },
          streamTimeout * 5,
        );
      }
    }
  }
});
