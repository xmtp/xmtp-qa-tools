import { sleep, streamColdStartTimeout } from "@helpers/client";
import { typeofStream } from "@workers/main";
import type { Worker } from "@workers/manager";
import {
  ConsentEntityType,
  ConsentState,
  type Client,
  type Conversation,
  type Group,
} from "@xmtp/node-sdk";

// Define the expected return type of verifyMessageStream
export type VerifyStreamResult = {
  allReceived: boolean;
  almostAllReceived: boolean;
  receiverCount: number;
  messages: string;
  eventTimings: string;
  averageEventTiming: number;
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

// Type guard for sent event with sentAt
function hasSentAt(obj: unknown): obj is { sentAt: number } {
  return (obj as { sentAt: number }).sentAt !== undefined;
}
function extractGroupName(ev: unknown): string {
  const event = ev as {
    content?: {
      metadataFieldChanges?: Array<{ fieldName: string; newValue: string }>;
    };
  };
  const changes = event.content?.metadataFieldChanges || [];
  const nameChange = changes.find((c) => c.fieldName === "group_name");
  return nameChange?.newValue || "";
}

/**
 * Extract added inbox IDs from a membership update event
 */
function extractAddedInboxes(ev: unknown): string {
  if (typeof ev !== "object" || ev === null) {
    return "";
  }

  const event = ev as {
    inboxId?: string; // For sent events
    addedInboxes?: Array<{ inboxId: string }>; // For direct events
    group?: {
      addedInboxes?: Array<{ inboxId: string }>; // For stream events
    };
    content?: {
      addedInboxes?: Array<{ inboxId: string }>; // Legacy format
    };
  };

  // If this is a sent event with inboxId directly
  if (event.inboxId) {
    return event.inboxId;
  }

  // Try top-level first (current format)
  let addedInboxes = event.addedInboxes || [];

  // Try group structure (stream events)
  if (addedInboxes.length === 0 && event.group?.addedInboxes) {
    addedInboxes = event.group.addedInboxes;
  }

  // Fallback to content structure (legacy format)
  if (addedInboxes.length === 0 && event.content?.addedInboxes) {
    addedInboxes = event.content.addedInboxes;
  }

  // Return the first added inbox ID, or empty string if none
  return addedInboxes.length > 0 ? addedInboxes[0].inboxId : "";
}

function extractContent(ev: unknown): string {
  if (typeof ev === "object" && ev !== null) {
    if (
      Object.prototype.hasOwnProperty.call(ev, "content") &&
      typeof (ev as Record<string, unknown>).content === "string"
    ) {
      return (ev as Record<string, string>).content;
    }
    if (
      Object.prototype.hasOwnProperty.call(ev, "message") &&
      typeof (ev as Record<string, unknown>).message === "object" &&
      (ev as Record<string, unknown>).message !== null &&
      typeof (ev as { message: { content?: unknown } }).message.content ===
        "string"
    ) {
      return (ev as { message: { content: string } }).message.content;
    }
  }
  return "";
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
  participantsForStats: Worker[];
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
  const collectPromises: Promise<
    { key: string; receivedAt: number; message: string; event: unknown }[]
  >[] = receivers.map((r) =>
    startCollectors(r).then((events) =>
      events.map((ev) => ({
        key: getKey(ev),
        receivedAt: Date.now(),
        message: getMessage(ev),
        event: ev,
      })),
    ),
  );
  await sleep(streamColdStartTimeout); // wait for stream to start
  const sentEvents = await options.triggerEvents();
  const allReceived = await Promise.all(collectPromises);
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
    msgs.map((m) => getMessage(m.event as TReceived)),
  );
  let stats;
  if (messageTemplate && messagesAsStrings.length > 0) {
    stats = calculateMessageStats(
      messagesAsStrings,
      statsLabel,
      count ?? 1,
      messageTemplate,
    );
  }
  // Transform eventTimings to arrays per name
  const eventTimingsArray: Record<string, number[]> = {};
  for (const [name, timingsObj] of Object.entries(eventTimings)) {
    // Convert keys to numbers and sort
    const arr = Object.entries(timingsObj)
      .map(([k, v]) => [parseInt(k, 10), v] as [number, number])
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v);
    eventTimingsArray[name] = arr;
  }
  const diff = count
    ? count * allReceived.length -
      allReceived.reduce((sum, arr) => sum + arr.length, 0)
    : 0;
  const allResults = {
    allReceived: diff === 0,
    almostAllReceived: diff <= 2,
    receiverCount: allReceived.length,
    messages: messagesAsStrings.join(","),
    eventTimings: Object.entries(eventTimingsArray)
      .map(([k, v]) => `${k}: ${v.join(",")}`)
      .join(","),
    averageEventTiming,
    receptionPercentage: stats?.receptionPercentage ?? 0,
    orderPercentage: stats?.orderPercentage ?? 0,
  };
  console.debug("allResults", JSON.stringify(allResults, null, 2));
  return allResults;
}

/**
 * Specialized function to verify message streams
 */
export async function verifyMessageStream(
  group: Conversation,
  receivers: Worker[],
  count = 1,
  messageTemplate: string = "gm-{i}-{randomSuffix}",
): Promise<VerifyStreamResult> {
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  receivers.forEach((worker) => {
    worker.worker.startStream(typeofStream.Message);
  });
  return collectAndTimeEventsWithStats({
    receivers,
    startCollectors: (r) => r.worker.collectMessages(group.id, count),
    triggerEvents: async () => {
      const sent: { content: string; sentAt: number }[] = [];
      for (let i = 0; i < count; i++) {
        let content = messageTemplate;
        content = content.replace("{i}", `${i + 1}`);
        content = content.replace("{randomSuffix}", randomSuffix);
        const sentAt = Date.now();
        await group.send(content);
        sent.push({ content, sentAt });
      }
      return sent;
    },
    getKey: extractContent,
    getMessage: extractContent,
    statsLabel: "gm-",
    count,
    messageTemplate: randomSuffix,
    participantsForStats: receivers,
  });
}

/**
 * Specialized function to verify group update streams
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
        let name = messageTemplate;
        name = name.replace("{i}", `${i + 1}`);
        name = name.replace("{randomSuffix}", randomSuffix);
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
    participantsForStats: receivers,
  });
}

/**
 * Specialized function to verify group membership streams
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
        await group.addMembers([member]);
        sent.push({ inboxId: member, sentAt });
      }
      return sent;
    },
    getKey: extractAddedInboxes,
    getMessage: extractAddedInboxes,
    statsLabel: "member-add:",
    count: 1,
    participantsForStats: receivers,
  });
}

/**
 * Specialized function to verify consent streams
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
    participantsForStats: receivers,
  });
}
/**
 * Specialized function to verify consent streams
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
    participantsForStats: [initiator],
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
      const participantAddresses = receivers.map((p) => {
        if (!p.client) throw new Error(`Participant ${p.name} has no client`);
        return p.client.inboxId;
      });
      const sentAt = Date.now();
      await initiator.client.conversations.newGroup(participantAddresses);
      return [{ id: "conversation", sentAt }];
    },
    getKey: (ev) => (ev as { id?: string }).id ?? "conversation",
    getMessage: (ev) => (ev as { id?: string }).id ?? "conversation",
    statsLabel: "conversation:",
    count: 1,
    messageTemplate: "",
    participantsForStats: receivers,
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
      const sentAt = Date.now();
      await group.addMembers(membersToAdd);
      return [{ id: "conversation", sentAt }];
    },
    getKey: (ev) => (ev as { id?: string }).id ?? "conversation",
    getMessage: (ev) => (ev as { id?: string }).id ?? "conversation",
    statsLabel: "conversation:",
    count: 1,
    messageTemplate: "",
    participantsForStats: receivers,
  });
}

/**
 * Verifies conversation streaming functionality for group member additions
 */
export async function verifyNewConversationStream(
  group: Group,
  receivers: Worker[],
): Promise<VerifyStreamResult> {
  receivers.forEach((worker) => {
    worker.worker.startStream(typeofStream.Conversation);
  });
  const creatorInboxId = (await group.metadata()).creatorInboxId;
  return collectAndTimeEventsWithStats({
    receivers,
    startCollectors: (r) => r.worker.collectConversations(creatorInboxId, 1),
    triggerEvents: async () => {
      const sentAt = Date.now();
      await group.addMembers(receivers.map((r) => r.client?.inboxId));
      return [{ id: "conversation", sentAt }];
    },
    getKey: (ev) => (ev as { id?: string }).id ?? "conversation",
    getMessage: (ev) => (ev as { id?: string }).id ?? "conversation",
    statsLabel: "conversation:",
    count: 1,
    messageTemplate: "",
    participantsForStats: receivers,
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
    const inOrder =
      messages.length === expectedMessages.length &&
      messages.every((msg, i) => msg === expectedMessages[i]);
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
 * Specialized function to verify bot response streams
 * Measures the time it takes for a bot to respond to a trigger message
 */
export async function verifyBotMessageStream(
  group: Conversation,
  receivers: Worker[],
  triggerMessage: string,
): Promise<VerifyStreamResult> {
  receivers.forEach((worker) => {
    worker.worker.startStream(typeofStream.Message);
  });
  return collectAndTimeEventsWithStats({
    receivers,
    startCollectors: (r) => r.worker.collectMessages(group.id, 1),
    triggerEvents: async () => {
      const sentAt = Date.now();
      await group.send(triggerMessage);
      // For bot responses, we use a fixed key since any response counts
      return [{ key: "bot-response", sentAt }];
    },
    getKey: () => "bot-response", // Fixed key for both sent and received
    getMessage: extractContent,
    statsLabel: "bot-response:",
    count: 1,
    messageTemplate: "",
    participantsForStats: receivers,
  });
}
