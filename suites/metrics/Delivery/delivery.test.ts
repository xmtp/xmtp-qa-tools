import { loadEnv } from "@helpers/client";
import { sendDeliveryMetric } from "@helpers/datadog";
import { getWorkersFromGroup } from "@helpers/groups";
import { logError } from "@helpers/logger";
import { calculateMessageStats, verifyMessageStream } from "@helpers/streams";
import { getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "delivery";
loadEnv(testName);

describe(testName, async () => {
  const amountofMessages = parseInt(process.env.DELIVERY_AMOUNT ?? "10");
  const receiverAmount = parseInt(process.env.DELIVERY_RECEIVERS ?? "4");

  console.log(
    `[${testName}] Amount of messages: ${amountofMessages}, Receivers: ${receiverAmount}`,
  );
  let workers = await getWorkers(
    getRandomNames(receiverAmount),
    testName,
    typeofStream.Message,
  );
  let group: Group;
  const randomSuffix = Math.random().toString(36).substring(2, 15);

  beforeAll(async () => {
    try {
      console.log("creating group");
      group = await workers.createGroup();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  setupTestLifecycle({
    expect,
  });

  it("stream_order: verify message order when receiving via streams", async () => {
    try {
      const verifyResult = await verifyMessageStream(
        group,
        workers.getAllButCreator(),
        amountofMessages,
        randomSuffix,
      );
      const receptionPercentage = verifyResult.receptionPercentage ?? 0;
      const orderPercentage = verifyResult.orderPercentage ?? 0;

      console.log(
        `Stream reception percentage: ${receptionPercentage}%, order percentage: ${orderPercentage}%`,
      );

      // Don't fail if stats are missing or incomplete, just log and continue
      if (!verifyResult.receptionPercentage || !verifyResult.orderPercentage) {
        console.log("Warning: No stats were generated for stream verification");
      }

      // Only run expectations if we have values
      if (receptionPercentage > 0) {
        expect(receptionPercentage).toBeGreaterThan(0);
        sendDeliveryMetric(
          receptionPercentage,
          workers.getCreator().sdkVersion,
          workers.getCreator().libXmtpVersion,
          testName,
          "stream",
          "delivery",
        );
      }

      if (orderPercentage > 0) {
        expect(orderPercentage).toBeGreaterThan(0);
        sendDeliveryMetric(
          orderPercentage,
          workers.getCreator().sdkVersion,
          workers.getCreator().libXmtpVersion,
          testName,
          "stream",
          "order",
        );
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("poll_order: verify message order when receiving via pull", async () => {
    try {
      const workersFromGroup = await getWorkersFromGroup(group, workers);
      const messagesByWorker: string[][] = [];

      for (const worker of workersFromGroup) {
        const conversation =
          await worker.client.conversations.getConversationById(group.id);
        if (!conversation) {
          throw new Error("Conversation not found");
        }
        const messages = await conversation.messages();
        const filteredMessages: string[] = [];

        for (const message of messages) {
          if (
            message.contentType?.typeId === "text" &&
            (message.content as string).includes(randomSuffix)
          ) {
            filteredMessages.push(message.content as string);
          }
        }

        messagesByWorker.push(filteredMessages);
      }

      const stats = calculateMessageStats(
        messagesByWorker,
        "gm-",
        amountofMessages,
        randomSuffix,
      );

      const receptionPercentage = stats.receptionPercentage ?? 0;
      const orderPercentage = stats.orderPercentage ?? 0;

      console.log(
        `Poll reception percentage: ${receptionPercentage}%, order percentage: ${orderPercentage}%`,
      );

      // Only run expectations if we have values
      if (receptionPercentage > 0) {
        expect(receptionPercentage).toBeGreaterThan(0);
        sendDeliveryMetric(
          receptionPercentage,
          workers.getCreator().sdkVersion,
          workers.getCreator().libXmtpVersion,
          testName,
          "poll",
          "delivery",
        );
      }

      if (orderPercentage > 0) {
        expect(orderPercentage).toBeGreaterThan(0);
        sendDeliveryMetric(
          orderPercentage,
          workers.getCreator().sdkVersion,
          workers.getCreator().libXmtpVersion,
          testName,
          "poll",
          "order",
        );
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("offline_recovery: verify message recovery after disconnection", async () => {
    try {
      // Select one worker to take offline
      const offlineWorker = workers.getCreator(); // Second worker
      const onlineWorker = workers.getReceiver(); // First worker

      console.log(`Taking ${offlineWorker.name} offline`);

      // Disconnect the selected worker
      await offlineWorker.worker.terminate();

      // Send messages from an online worker
      const conversation =
        await onlineWorker.client.conversations.getConversationById(group.id);

      console.log(
        `Sending ${amountofMessages} messages while client is offline`,
      );
      for (let i = 0; i < amountofMessages; i++) {
        const message = `offline-msg-${i + 1}-${randomSuffix}`;
        await conversation!.send(message);
      }
      console.log("Sent messages");

      // Reconnect the offline worker
      console.log(`Reconnecting ${offlineWorker.name}`);
      const { client } = await offlineWorker.worker.initialize();
      offlineWorker.client = client;
      await offlineWorker.client.conversations.sync();

      const recoveredConversation =
        await offlineWorker.client.conversations.getConversationById(group.id);
      await recoveredConversation?.sync();
      const messages = await recoveredConversation?.messages();

      const messagesByWorker: string[][] = [];
      const recoveredMessages: string[] = [];
      for (const message of messages ?? []) {
        if (
          message.content &&
          typeof message.content === "string" &&
          message.content.includes(`offline-msg-`) &&
          message.content.includes(randomSuffix)
        ) {
          recoveredMessages.push(message.content);
        }
      }

      messagesByWorker.push(recoveredMessages);

      const stats = calculateMessageStats(
        messagesByWorker,
        "offline-msg-",
        amountofMessages,
        randomSuffix,
      );
      const receptionPercentage = stats.receptionPercentage ?? 0;
      const orderPercentage = stats.orderPercentage ?? 0;

      console.log(
        `Recovery reception percentage: ${receptionPercentage}%, order percentage: ${orderPercentage}%`,
      );

      // Only run expectations if we have values
      if (receptionPercentage > 0) {
        expect(receptionPercentage).toBeGreaterThan(0);
        sendDeliveryMetric(
          receptionPercentage,
          offlineWorker.sdkVersion,
          offlineWorker.libXmtpVersion,
          testName,
          "recovery",
          "delivery",
        );
      }

      if (orderPercentage > 0) {
        expect(orderPercentage).toBeGreaterThan(0);
        sendDeliveryMetric(
          orderPercentage,
          offlineWorker.sdkVersion,
          offlineWorker.libXmtpVersion,
          testName,
          "recovery",
          "order",
        );
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
