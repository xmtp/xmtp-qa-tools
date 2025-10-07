import { sleep, streamColdStartTimeout } from "@helpers/client";
import { typeofStream } from "@workers/main";
import type { Worker } from "@workers/manager";
import {
  ConsentEntityType,
  ConsentState,
  type Client,
  type Conversation,
  type Dm,
  type Group,
} from "version-management/node-versions";

// Define the expected return type of verifyMessageStream
export type VerifyStreamResult = {
  averageEventTiming: number | undefined;
  receptionPercentage: number;
  orderPercentage: number;
};

export async function updateGroupConsent(
  client: Client,
  group: Group,
): Promise<void> {
  const getState = await group.consentState;
  await client.preferences.setConsentStates([
    {
      entity: group.id,
      entityType: ConsentEntityType.GroupId,
      state:
        getState === ConsentState.Allowed
          ? ConsentState.Denied
          : ConsentState.Allowed,
    },
  ]);
}

// Generic property extractor
function getProperty<T>(
  obj: unknown,
  path: string[],
  defaultValue?: T,
): T | undefined {
  let current: any = obj;
  for (const key of path) {
    if (current && typeof current === "object" && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }
  return current as T;
}

// Simplified type guard and property extractors
function hasSentAt(obj: unknown): obj is { sentAt: number } {
  return getProperty<number>(obj, ["sentAt"]) !== undefined;
}

function extractGroupName(ev: unknown): string {
  const changes =
    getProperty<Array<{ fieldName: string; newValue: string }>>(ev, [
      "content",
      "metadataFieldChanges",
    ]) || [];
  const nameChange = changes.find((c) => c.fieldName === "group_name");
  return nameChange?.newValue || "";
}

function extractAddedInboxes(ev: unknown): string {
  // Try different paths for added inboxes
  const paths = [
    ["inboxId"],
    ["addedInboxes", "0", "inboxId"],
    ["group", "addedInboxes", "0", "inboxId"],
    ["content", "addedInboxes", "0", "inboxId"],
  ];

  for (const path of paths) {
    const result = getProperty<string>(ev, path);
    if (result) return result;
  }
  return "";
}

function extractContent(ev: unknown): string {
  const content = getProperty<string>(ev, ["content"]);
  if (content) return content;

  const messageContent = getProperty<string>(ev, ["message", "content"]);
  return messageContent || "";
}

function extractTimestamp(ev: unknown): number | null {
  const timestampFields = ["receivedAt", "timestamp", "sentAt", "createdAt"];

  // Try top-level fields
  for (const field of timestampFields) {
    const value = getProperty<number>(ev, [field]);
    if (value) return value;
  }

  // Try nested in message object
  for (const field of timestampFields) {
    const value = getProperty<number>(ev, ["message", field]);
    if (value) return value;
  }

  return null;
}

/**
 * Generic helper to collect, time, and compute stats for any stream event.
 */
async function collectAndTimeEventsWithStats<TSent, TReceived>(options: {
  receivers: Worker[];
  startCollectors: (receiver: Worker) => Promise<TReceived[]>;
  triggerEvents: () => Promise<TSent[]>;
  getKey: (event: TSent | TReceived) => string;
  getMessage: (event: TSent | TReceived) => string;
  statsLabel: string;
  count?: number;
  messageTemplate?: string;
  membersForStats: Worker[];
}) {
  const {
    receivers,
    startCollectors,
    getKey,
    getMessage,
    statsLabel,
    count,
    messageTemplate,
  } = options;

  // Sync conversations for all receiving workers
  await Promise.all(
    receivers.map((worker) => worker.client.conversations.sync()),
  );

  // Start collectors FIRST - before any messages are sent
  const collectPromises = receivers.map((r) =>
    startCollectors(r).then((events) =>
      events.map((ev) => ({
        key: getKey(ev),
        receivedAt: extractTimestamp(ev) || Date.now(),
        message: getMessage(ev),
        event: ev,
      })),
    ),
  );

  // Wait for streams to be ready and collectors to be active
  await sleep(streamColdStartTimeout);

  // NOW send the messages - after collectors are listening
  const sentEvents = await options.triggerEvents();

  // Wait for all collectors to finish
  const allReceived = await Promise.all(collectPromises);

  // Calculate timing statistics
  const eventTimings: Record<string, Record<number, number>> = {};
  let timingSum = 0;
  let timingCount = 0;

  receivers.forEach((r, idx) => {
    const received = allReceived[idx];
    eventTimings[r.name] = {};
    received.forEach((msg) => {
      const sentIdx = sentEvents.findIndex((s) => getKey(s) === msg.key);
      if (sentIdx !== -1 && hasSentAt(sentEvents[sentIdx])) {
        const duration =
          msg.receivedAt - (sentEvents[sentIdx] as { sentAt: number }).sentAt;
        eventTimings[r.name][sentIdx] = duration;
        timingSum += duration;
        timingCount++;
      }
    });
  });

  const averageEventTiming = Math.round(
    timingCount > 0 ? timingSum / timingCount : 0,
  );

  const messagesAsStrings = allReceived.map((msgs) =>
    msgs.map((m) => getMessage(m.event)),
  );

  const stats = calculateMessageStats(
    messagesAsStrings,
    statsLabel,
    count ?? 1,
    messageTemplate || "",
  );

  const allResults = {
    averageEventTiming:
      averageEventTiming === 0 ? undefined : averageEventTiming,
    receptionPercentage: stats?.receptionPercentage,
    orderPercentage: stats?.orderPercentage,
  };
  console.debug("allResults", JSON.stringify(allResults, null, 2));
  return allResults;
}

/**
 * Specialized function to message streams
 */
export async function verifyMessageStream(
  group: Dm | Group | Conversation,
  receivers: Worker[],
  count = 1,
  messageTemplate: string = "gm-{i}-{randomSuffix}",
  customTimeout?: number,
): Promise<VerifyStreamResult> {
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  receivers.forEach((worker) => {
    worker.worker.startStream(typeofStream.Message);
  });

  return collectAndTimeEventsWithStats({
    receivers,
    startCollectors: (r) =>
      r.worker.collectMessages(group.id, count, ["text"], customTimeout),
    triggerEvents: async () => {
      const sent: { content: string; sentAt: number }[] = [];
      for (let i = 0; i < count; i++) {
        let content = messageTemplate
          .replace("{i}", `${i + 1}`)
          .replace("{randomSuffix}", randomSuffix);
        const sentAt = Date.now();
        await group.send(content);
        sent.push({ content, sentAt });

        // Add small delay between messages to prevent overwhelming
        if (i < count - 1) {
          await sleep(50); // 50ms delay between messages
        }
      }
      return sent;
    },
    getKey: extractContent,
    getMessage: extractContent,
    statsLabel: "gm-",
    count,
    messageTemplate: randomSuffix,
    membersForStats: receivers,
  });
}

/**
 * Specialized function to group update streams
 */
export async function verifyMetadataStream(
  group: Group,
  receivers: Worker[],
  count = 1,
  messageTemplate: string = "gm-{i}-{randomSuffix}",
): Promise<VerifyStreamResult> {
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  receivers.forEach((worker) => {
    worker.worker.startStream(typeofStream.GroupUpdated);
  });
  return collectAndTimeEventsWithStats({
    receivers,
    startCollectors: (r) => r.worker.collectGroupUpdates(group.id, count),
    triggerEvents: async () => {
      const sent: { name: string; sentAt: number }[] = [];
      for (let i = 0; i < count; i++) {
        let name = messageTemplate
          .replace("{i}", `${i + 1}`)
          .replace("{randomSuffix}", randomSuffix);
        const sentAt = Date.now();
        await group.updateName(name);
        sent.push({ name, sentAt });
      }
      return sent;
    },
    getKey: extractGroupName,
    getMessage: extractGroupName,
    statsLabel: "New name-",
    count,
    messageTemplate,
    membersForStats: receivers,
  });
}

/**
 * Specialized function to group membership streams
 */
export async function verifyMembershipStream(
  group: Group,
  receivers: Worker[],
  membersToAdd: string[],
): Promise<VerifyStreamResult> {
  receivers.forEach((worker) => {
    worker.worker.startStream(typeofStream.GroupUpdated);
  });
  return collectAndTimeEventsWithStats({
    receivers,
    startCollectors: (r) => r.worker.collectGroupUpdates(group.id, 1),
    triggerEvents: async () => {
      const sent: { inboxId: string; sentAt: number }[] = [];
      const sentAt = Date.now();
      for (const member of membersToAdd) {
        try {
          await group.addMembers([member]);
        } catch (error) {
          console.error("Error adding member to group", error);
          console.error("member", member);
        }
        sent.push({ inboxId: member, sentAt });
      }
      return sent;
    },
    getKey: extractAddedInboxes,
    getMessage: extractAddedInboxes,
    statsLabel: "member-add:",
    count: 1,
    membersForStats: receivers,
  });
}

/**
 * Specialized function to consent streams
 */
export async function verifyGroupConsentStream(
  group: Group,
  receivers: Worker[],
): Promise<VerifyStreamResult> {
  receivers.forEach((worker) => {
    worker.worker.startStream(typeofStream.Consent);
  });
  return collectAndTimeEventsWithStats({
    receivers: receivers.filter((r) => r.client?.inboxId !== group.id),
    startCollectors: (r) => r.worker.collectConsentUpdates(1),
    triggerEvents: async () => {
      const sentAt = Date.now();
      for (const p of receivers) {
        await updateGroupConsent(p.client, group);
      }
      return [{ key: "consent", sentAt }];
    },
    getKey: (ev) => (ev as { key?: string }).key ?? "consent",
    getMessage: (ev) => (ev as { key?: string }).key ?? "consent",
    statsLabel: "consent:",
    count: 1,
    messageTemplate: "",
    membersForStats: receivers,
  });
}

/**
 * Specialized function to consent streams
 */
export async function verifyConsentStream(
  initiator: Worker,
  receiver: Worker,
): Promise<VerifyStreamResult> {
  receiver.worker.startStream(typeofStream.Consent);

  return collectAndTimeEventsWithStats({
    receivers: [receiver],
    startCollectors: (r) => r.worker.collectConsentUpdates(1),
    triggerEvents: async () => {
      const sentAt = Date.now();
      const getState = await receiver.client.preferences.getConsentState(
        ConsentEntityType.InboxId,
        receiver.client.inboxId,
      );

      await receiver.client.preferences.setConsentStates([
        {
          entity: receiver.client.inboxId,
          entityType: ConsentEntityType.InboxId,
          state:
            getState === ConsentState.Allowed
              ? ConsentState.Denied
              : ConsentState.Allowed,
        },
      ]);
      return [{ key: "consent", sentAt }];
    },
    getKey: (ev) => (ev as { key?: string }).key ?? "consent",
    getMessage: (ev) => (ev as { key?: string }).key ?? "consent",
    statsLabel: "consent:",
    count: 1,
    messageTemplate: "",
    membersForStats: [initiator],
  });
}

/**
 * Verifies conversation streaming functionality
 */
export async function verifyConversationStream(
  initiator: Worker,
  receivers: Worker[],
): Promise<VerifyStreamResult> {
  receivers.forEach((worker) => {
    worker.worker.startStream(typeofStream.Conversation);
  });
  return collectAndTimeEventsWithStats({
    receivers,
    startCollectors: (r) =>
      r.worker.collectConversations(initiator.client.inboxId, 1),
    triggerEvents: async () => {
      const sentAt = Date.now();
      const conversation = await initiator.client.conversations.newGroup(
        receivers.map((r) => r.client.inboxId),
      );
      console.debug("conversation created", conversation.id);
      return [{ id: "conversation", sentAt, members: receivers }];
    },
    getKey: (ev) => (ev as { id?: string }).id ?? "conversation",
    getMessage: (ev) => (ev as { id?: string }).id ?? "conversation",
    statsLabel: "conversation:",
    count: 1,
    messageTemplate: "",
    membersForStats: receivers,
  });
}

export async function verifyAddMemberStream(
  group: Group,
  receivers: Worker[],
  membersToAdd: string[],
): Promise<VerifyStreamResult> {
  receivers.forEach((worker) => {
    worker.worker.startStream(typeofStream.GroupUpdated);
  });
  return collectAndTimeEventsWithStats({
    receivers,
    startCollectors: (r) => r.worker.collectAddedMembers(group.id, 1),
    triggerEvents: async () => {
      const sent: { inboxId: string; sentAt: number }[] = [];
      const sentAt = Date.now();
      await group.addMembers(membersToAdd);
      // Return the actual member data that was added
      for (const member of membersToAdd) {
        sent.push({ inboxId: member, sentAt });
      }
      return sent;
    },
    getKey: extractAddedInboxes,
    getMessage: extractAddedInboxes,
    statsLabel: "member-add:",
    count: 1,
    messageTemplate: "",
    membersForStats: receivers,
  });
}

/**
 * Calculates message reception and order statistics
 */
export function calculateMessageStats(
  messagesByWorker: string[][],
  prefix: string,
  amount: number,
  suffix: string,
) {
  // Helper: check if arr is an ordered subsequence of expected
  function isOrderedSubsequence(arr: string[], expected: string[]): boolean {
    if (arr.length === 0) return false;
    let i = 0;
    for (let j = 0; j < expected.length && i < arr.length; j++) {
      if (arr[i] === expected[j]) {
        i++;
      }
    }
    return i === arr.length;
  }

  const verifyMessageOrder = (
    messages: string[],
    expectedPrefix: string = "gm-",
    expectedCount?: number,
  ) => {
    if (messages.length === 0) return { inOrder: false, expectedMessages: [] };
    const count = expectedCount || messages.length;
    const expectedMessages = Array.from(
      { length: count },
      (_, i) => `${expectedPrefix}${i + 1}-${suffix}`,
    );
    // Use subsequence check instead of strict equality
    const inOrder = isOrderedSubsequence(messages, expectedMessages);
    return { inOrder, expectedMessages };
  };
  let totalExpectedMessages = amount * messagesByWorker.length;
  let totalReceivedMessages = messagesByWorker.reduce(
    (sum, msgs) => sum + msgs.length,
    0,
  );
  let workersInOrder = 0;
  const workerCount = messagesByWorker.length;
  for (const messages of messagesByWorker) {
    const { inOrder } = verifyMessageOrder(messages, prefix, amount);
    if (inOrder) workersInOrder++;
  }
  const receptionPercentage =
    (totalReceivedMessages / totalExpectedMessages) * 100;
  const orderPercentage = (workersInOrder / workerCount) * 100;
  return { receptionPercentage, orderPercentage };
}

/**
 * Specialized function to bot response streams
 * Measures the time it takes for a bot to respond to a trigger message
 * Includes retry logic and fallback message count validation
 */
export async function verifyAgentMessageStream(
  group: Conversation,
  receivers: Worker[],
  triggerMessage: string,
  maxRetries: number = 1,
  types: string[] = ["text", "reply", "reaction", "actions"],
  customTimeout?: number,
): Promise<VerifyStreamResult | undefined> {
  receivers.forEach((worker) => {
    worker.worker.startStream(typeofStream.Message);
  });

  let attempts = 0;
  let result: VerifyStreamResult | undefined;

  while (attempts < maxRetries) {
    result = await collectAndTimeEventsWithStats({
      receivers,
      startCollectors: (r) =>
        r.worker.collectMessages(
          group.id,
          1,
          types,
          customTimeout ?? undefined,
        ),
      // @ts-expect-error - TODO: fix this
      triggerEvents: () => {
        const sentAt = Date.now();
        group.send(triggerMessage).catch(console.error);

        return [{ conversationId: group.id, sentAt }];
      },
      getKey: () => group.id, // Use conversation ID as consistent key for both sent and received
      getMessage: extractContent,
      statsLabel: "bot-response:",
      count: 1,
      messageTemplate: "",
      membersForStats: receivers,
    });

    if (result && result.averageEventTiming !== undefined) {
      // Check if averageEventTiming is defined
      return result;
    }

    attempts++;
  }
  receivers.forEach((worker) => {
    worker.worker.stopStreams();
  });
  return result;
}
