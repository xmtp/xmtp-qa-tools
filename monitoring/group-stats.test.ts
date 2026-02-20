import { loadEnv, streamTimeout } from "@helpers/client";
import { flushMetrics, initializeDatadog } from "@helpers/datadog";
import {
  sendStatsDurationMetric,
  sendStatsOperationCount,
  sendStatsRateMetric,
  sendStatsResponseMetric,
} from "@helpers/group-metrics";
import { sendTextCompat } from "@helpers/sdk-compat";
import { verifyMembershipStream, verifyMessageStream } from "@helpers/streams";
import { IdentifierKind, type Group } from "@helpers/versions";
import { getInboxes, type InboxData } from "@inboxes/utils";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "group-stats";
const messageCount = Number.parseInt(
  process.env.GROUP_STATS_MESSAGE_COUNT ?? "5",
  10,
);
const batchSizes = process.env.BATCH_SIZE
  ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
  : [10];

function reportOperationFailure(input: {
  sdk: string;
  members: number;
  operationName: string;
  legacyOperation?: string;
  runMode?: "cold" | "warm" | "stream";
}): void {
  sendStatsOperationCount({
    test: testName,
    sdk: input.sdk,
    members: input.members,
    operationName: input.operationName,
    legacyOperation: input.legacyOperation,
    runMode: input.runMode,
    status: "error",
  });
}

describe(testName, () => {
  let workers: WorkerManager;
  let creator: Worker;

  beforeAll(async () => {
    loadEnv(testName);
    initializeDatadog();
    workers = await getWorkers(10, { randomNames: false });
    creator = workers.mustGetCreator();
  });

  afterAll(async () => {
    await flushMetrics();
  });

  for (const memberCount of batchSizes) {
    let group: Group;
    let groupWorkers: Worker[] = [];
    let extraMember: InboxData;

    async function ensureGroupContext(): Promise<number | undefined> {
      if (group) {
        return undefined;
      }

      const allMembersWithExtra = getInboxes(
        memberCount - workers.getAll().length + 2,
        2,
        memberCount,
      );
      const allMembers = allMembersWithExtra.slice(
        0,
        allMembersWithExtra.length - 2,
      );
      extraMember = allMembersWithExtra.at(-1)!;
      const workersToAdd = workers
        .getAllButCreator()
        .slice(0, memberCount - 1 - allMembers.length);
      groupWorkers = workersToAdd;

      const membersToAdd = [
        ...allMembers.map((a) => ({
          identifier: a.accountAddress,
          identifierKind: IdentifierKind.Ethereum,
        })),
        ...workersToAdd.map((w) => ({
          identifier: w.address,
          identifierKind: IdentifierKind.Ethereum,
        })),
      ];

      const start = performance.now();
      group = (await creator.worker.createGroupWithIdentifiers(
        membersToAdd,
      )) as Group;
      return performance.now() - start;
    }

    it(`newGroup-${memberCount}:group.create_with_members`, async () => {
      try {
        const duration = await ensureGroupContext();

        const members = await group.members();
        expect(members.length).toBe(memberCount);
        expect(group.id).toBeDefined();

        if (typeof duration === "number") {
          sendStatsDurationMetric({
            test: testName,
            sdk: creator.sdk,
            members: memberCount,
            operationName: "group.create_with_members",
            legacyOperation: "newGroup",
            runMode: "warm",
            valueMs: duration,
          });
        }
      } catch (error) {
        reportOperationFailure({
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.create_with_members",
          legacyOperation: "newGroup",
          runMode: "warm",
        });
        throw error;
      }
    });

    it(`addMember-${memberCount}:group.add_members and group.add_member_unit`, async () => {
      try {
        await ensureGroupContext();

        await group.removeMembers([extraMember.inboxId]);

        const start = performance.now();
        await group.addMembers([extraMember.inboxId]);
        const duration = performance.now() - start;

        sendStatsDurationMetric({
          test: testName,
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.add_members",
          legacyOperation: "addMember",
          runMode: "warm",
          valueMs: duration,
        });

        sendStatsDurationMetric({
          test: testName,
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.add_member_unit",
          legacyOperation: "addMember",
          runMode: "warm",
          valueMs: duration,
        });
      } catch (error) {
        reportOperationFailure({
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.add_members",
          legacyOperation: "addMember",
          runMode: "warm",
        });
        reportOperationFailure({
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.add_member_unit",
          legacyOperation: "addMember",
          runMode: "warm",
        });
        throw error;
      }
    });

    it(`removeMembers-${memberCount}:group.remove_members`, async () => {
      try {
        await ensureGroupContext();

        const start = performance.now();
        await group.removeMembers([extraMember.inboxId]);
        const duration = performance.now() - start;

        sendStatsDurationMetric({
          test: testName,
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.remove_members",
          legacyOperation: "removeMembers",
          runMode: "warm",
          valueMs: duration,
        });

        await group.addMembers([extraMember.inboxId]);
      } catch (error) {
        reportOperationFailure({
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.remove_members",
          legacyOperation: "removeMembers",
          runMode: "warm",
        });
        throw error;
      }
    });

    it(`send-${memberCount}:group.send_message`, async () => {
      try {
        await ensureGroupContext();

        const payload = `stats-gm-${Math.random().toString(36).slice(2, 10)}`;
        const start = performance.now();
        await sendTextCompat(group, payload);
        const duration = performance.now() - start;

        sendStatsDurationMetric({
          test: testName,
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.send_message",
          legacyOperation: "send",
          runMode: "warm",
          valueMs: duration,
        });
      } catch (error) {
        reportOperationFailure({
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.send_message",
          legacyOperation: "send",
          runMode: "warm",
        });
        throw error;
      }
    });

    it(`sync-${memberCount}:group.sync_read`, async () => {
      try {
        await ensureGroupContext();

        const randomName = `statssync${Math.random().toString(36).slice(2, 6)}`;
        const syncWorkers = await getWorkers([randomName]);
        const syncClient = syncWorkers.mustGet(randomName).client;
        await group.addMembers([syncClient.inboxId]);

        const start = performance.now();
        await syncClient.conversations.sync();
        const duration = performance.now() - start;

        sendStatsDurationMetric({
          test: testName,
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.sync_read",
          legacyOperation: "sync",
          runMode: "cold",
          valueMs: duration,
        });
      } catch (error) {
        reportOperationFailure({
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.sync_read",
          legacyOperation: "sync",
          runMode: "cold",
        });
        throw error;
      }
    });

    it(`streamMembership-${memberCount}:group.member_visibility`, async () => {
      try {
        await ensureGroupContext();

        await group.removeMembers([extraMember.inboxId]);
        const verify = await verifyMembershipStream(group, groupWorkers, [
          extraMember.inboxId,
        ]);
        const duration = verify.averageEventTiming ?? streamTimeout;

        expect(verify.receptionPercentage).toBeGreaterThanOrEqual(90);

        sendStatsDurationMetric({
          test: testName,
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.member_visibility",
          legacyOperation: "streamMembership",
          runMode: "stream",
          valueMs: duration,
        });
      } catch (error) {
        reportOperationFailure({
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.member_visibility",
          legacyOperation: "streamMembership",
          runMode: "stream",
        });
        throw error;
      }
    });

    it(`streamMessage-${memberCount}:group.receive_message + delivery/order`, async () => {
      try {
        await ensureGroupContext();

        // Keep high-member stream checks stable by reducing burst fanout.
        const streamMessageCount = memberCount >= 50 ? 1 : messageCount;

        const verify = await verifyMessageStream(
          group,
          groupWorkers,
          streamMessageCount,
          "gm-{i}-{randomSuffix}",
          60 * 1000,
        );
        const receiveDuration = verify.averageEventTiming ?? streamTimeout;

        expect(verify.receptionPercentage).toBeGreaterThanOrEqual(90);
        expect(verify.orderPercentage).toBeGreaterThanOrEqual(90);

        sendStatsDurationMetric({
          test: testName,
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.receive_message",
          legacyOperation: "streamMessage",
          runMode: "stream",
          valueMs: receiveDuration,
        });

        sendStatsResponseMetric({
          test: testName,
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.receive_message",
          legacyOperation: "streamMessage",
          runMode: "stream",
          valueMs: receiveDuration,
        });

        sendStatsRateMetric({
          test: testName,
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.delivery_rate",
          legacyOperation: "streamMessage",
          runMode: "stream",
          series: "delivery",
          metricName: "group.delivery_rate.pct",
          valuePct: verify.receptionPercentage,
        });

        sendStatsRateMetric({
          test: testName,
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.order_rate",
          legacyOperation: "streamMessage",
          runMode: "stream",
          series: "order",
          metricName: "group.order_rate.pct",
          valuePct: verify.orderPercentage,
        });
      } catch (error) {
        reportOperationFailure({
          sdk: creator.sdk,
          members: memberCount,
          operationName: "group.receive_message",
          legacyOperation: "streamMessage",
          runMode: "stream",
        });
        throw error;
      }
    });
  }
});
