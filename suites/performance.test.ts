import { streamTimeout } from "@helpers/client";
import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getAddresses, getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { Client, IdentifierKind, type Dm, type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "performance";
describe(testName, async () => {
  // Cumulative tracking variables
  let cumulativeWorkers: string[] = [];
  let cumulativeGroup: Group | undefined = undefined;
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [5, 10];
  let dm: Dm | undefined;
  let workers = await getWorkers(10, {
    randomNames: false,
  });

  let newGroup: Group;
  const creator = workers.getCreator();
  const receiver = workers.getReceiver();
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
  it("setupup accounts", async () => {
    const client = await getWorkers(["randomclient"]);
    expect(client).toBeDefined();
  });

  it("create:measure creating a client", async () => {
    const client = await getWorkers(["randomclient"]);
    expect(client).toBeDefined();
  });
  it("canMessage:measure canMessage", async () => {
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

  it("inboxState:measure inboxState", async () => {
    const inboxState = await creatorClient.preferences.inboxState(true);
    expect(inboxState.installations.length).toBeGreaterThan(0);
  });
  it("newDm:measure creating a DM", async () => {
    dm = (await creatorClient.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    expect(dm).toBeDefined();
    expect(dm.id).toBeDefined();
  });

  it("send:measure sending a gm", async () => {
    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    const dmId = await dm!.send(message);

    expect(dmId).toBeDefined();
  });

  it("stream:measure receiving a gm", async () => {
    const verifyResult = await verifyMessageStream(dm!, [receiver]);

    sendMetric("response", verifyResult.averageEventTiming, {
      test: testName,
      metric_type: "stream",
      metric_subtype: "message",
      sdk: receiver.sdk,
    } as ResponseMetricTags);

    setCustomDuration(verifyResult.averageEventTiming ?? streamTimeout);
    expect(verifyResult.allReceived).toBe(true);
  });
  it("newDmByAddress:measure creating a DM", async () => {
    const dm2 = await creatorClient.conversations.newDmWithIdentifier({
      identifier: workers.getAll()[2].address,
      identifierKind: IdentifierKind.Ethereum,
    });

    expect(dm2).toBeDefined();
    expect(dm2.id).toBeDefined();
  });

  for (const i of BATCH_SIZE) {
    const creatorClient = workers.getCreator().client;
    it(`newGroup-${i}:create a large group of ${i} members ${i}`, async () => {
      const sliced = getInboxIds(i);
      newGroup = (await creatorClient.conversations.newGroup([
        ...sliced,
        ...workers.getAllButCreator().map((w) => w.client.inboxId),
      ])) as Group;
      expect(newGroup.id).toBeDefined();
    });
    it(`newGroupByAddress-${i}:create a large group of ${i} members ${i}`, async () => {
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
    it(`groupsync-${i}:sync a large group of ${i} members ${i}`, async () => {
      await newGroup.sync();
      const members = await newGroup.members();
      expect(members.length).toBe(members.length);
    });
    it(`updateName-${i}:update the group name`, async () => {
      const newName = "Large Group";
      await newGroup.updateName(newName);
      await newGroup.sync();
      const name = newGroup.name;
      expect(name).toBe(newName);
    });
    it(`send-${i}:measure sending a gm in a group of ${i} members`, async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      await newGroup.send(groupMessage);
      expect(groupMessage).toBeDefined();
    });
    it(`streamMessage-${i}:verify group message`, async () => {
      const verifyResult = await verifyMessageStream(
        newGroup,
        workers.getAllButCreator(),
      );
      sendMetric("response", verifyResult.averageEventTiming, {
        test: testName,
        metric_type: "stream",
        metric_subtype: "message",
        sdk: workers.getCreator().sdk,
        members: i.toString(),
        installations: i.toString(),
      } as ResponseMetricTags);

      setCustomDuration(verifyResult?.averageEventTiming ?? 0);
      expect(verifyResult.almostAllReceived).toBe(true);
    });
    it(`addMember-${i}:add members to a group`, async () => {
      await newGroup.addMembers([workers.getAll()[2].inboxId]);
    });
    it(`removeMembers-${i}:remove a participant from a group`, async () => {
      const previousMembers = await newGroup.members();
      await newGroup.removeMembers([
        previousMembers.filter(
          (member) => member.inboxId !== newGroup.addedByInboxId,
        )[0].inboxId,
      ]);

      const members = await newGroup.members();
      expect(members.length).toBe(previousMembers.length - 1);
    });
    it(`streamMembership-${i}:notify all members of additions in ${i} member group`, async () => {
      const extraMember = allMembersWithExtra.slice(i, i + 1);
      console.log(extraMember);
      const verifyResult = await verifyMembershipStream(
        newGroup,
        workers.getAllButCreator(),
        extraMember,
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`streamMessage-${i}:notify all members of message changes in ${i} member group`, async () => {
      const verifyResult = await verifyMessageStream(
        newGroup,
        workers.getAllButCreator(),
      );

      sendMetric("response", verifyResult.averageEventTiming, {
        test: testName,
        metric_type: "stream",
        metric_subtype: "message",
        sdk: workers.getCreator().sdk,
      } as ResponseMetricTags);

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`streamMetadata-${i}:notify all members of metadata changes in ${i} member group`, async () => {
      const verifyResult = await verifyMetadataStream(
        newGroup,
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`sync-${i}:perform cold start sync operations on ${i} member group`, async () => {
      const singleSyncWorkers = await getWorkers(["randomA"]);
      const clientSingleSync = singleSyncWorkers.get("randomA")!.client;
      await newGroup.addMembers([clientSingleSync.inboxId]);
      const start = performance.now();
      await clientSingleSync.conversations.sync();
      const end = performance.now();
      setCustomDuration(end - start);
    });
    it(`syncAll-${i}:perform cold start sync operations on ${i} member group`, async () => {
      const singleSyncWorkers = await getWorkers(["randomB"]);
      const clientSingleSync = singleSyncWorkers.get("randomB")!.client;
      await newGroup.addMembers([clientSingleSync.inboxId]);
      const start = performance.now();
      await clientSingleSync.conversations.syncAll();
      const end = performance.now();
      setCustomDuration(end - start);
    });

    // Cumulative sync tests
    it(`cumulativeSync-${i}:perform cumulative sync operations on ${i} member group`, async () => {
      // Add new workers for this run
      const newWorkers = await getWorkers(["workerAA", "workerBB"]);
      const workerAA = newWorkers.get("workerAA")!.client;
      const workerBB = newWorkers.get("workerBB")!.client;

      // Add to cumulative tracking
      cumulativeWorkers.push(workerAA.inboxId, workerBB.inboxId);

      // Create or update cumulative group
      if (!cumulativeGroup) {
        cumulativeGroup = await workers.createGroupBetweenAll(
          "Cumulative Sync Test",
          cumulativeWorkers,
        );
      } else {
        await cumulativeGroup.addMembers([workerAA.inboxId, workerBB.inboxId]);
      }

      // Measure sync time for all workers in cumulative group
      const start = performance.now();
      await workerAA.conversations.sync();
      await workerBB.conversations.sync();
      const end = performance.now();

      setCustomDuration(end - start);

      // Send metric with cumulative info
      sendMetric("cumulative_sync", end - start, {
        test: testName,
        metric_type: "cumulative_sync",
        metric_subtype: "sync",
        group_size: i.toString(),
        total_workers: cumulativeWorkers.length.toString(),
        sdk: workers.getCreator().sdk,
      } as ResponseMetricTags);
    });

    it(`cumulativeSyncAll-${i}:perform cumulative syncAll operations on ${i} member group`, async () => {
      // Add new workers for this run
      const newWorkers = await getWorkers(["workerCC", "workerDD"]);
      const workerCC = newWorkers.get("workerCC")!.client;
      const workerDD = newWorkers.get("workerDD")!.client;

      // Add to cumulative tracking
      cumulativeWorkers.push(workerCC.inboxId, workerDD.inboxId);

      // Update cumulative group
      if (cumulativeGroup) {
        await cumulativeGroup.addMembers([workerCC.inboxId, workerDD.inboxId]);
      }

      // Measure syncAll time for all workers in cumulative group
      const start = performance.now();
      await workerCC.conversations.syncAll();
      await workerDD.conversations.syncAll();
      const end = performance.now();

      setCustomDuration(end - start);

      // Send metric with cumulative info
      sendMetric("cumulative_syncAll", end - start, {
        test: testName,
        metric_type: "cumulative_syncAll",
        metric_subtype: "syncAll",
        group_size: i.toString(),
        total_workers: cumulativeWorkers.length.toString(),
        sdk: workers.getCreator().sdk,
      } as ResponseMetricTags);
    });
  }
});
