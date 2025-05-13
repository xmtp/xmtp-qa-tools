import type { Worker } from "@workers/manager";
import {
  ConsentEntityType,
  ConsentState,
  type Client,
  type Conversation,
  type Group,
} from "@xmtp/node-sdk";
import { sleep } from "./tests";

// Define the expected return type of verifyMessageStream
export type VerifyStreamResult = {
  allReceived: boolean;
  messages: unknown[][];
  receiverCount: number;
  eventTimings: Record<string, number[]>;
  averageEventTiming: number;
  stats?: {
    receptionPercentage: number;
    orderPercentage: number;
    workersInOrder: number;
    workerCount: number;
    totalReceivedMessages: number;
    totalExpectedMessages: number;
  };
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
/**
 * Create a group consent sender that blocks both the group and a specific member
 */
export async function updateInboxConsent(
  worker: Worker,
  memberInboxId: string,
): Promise<void> {
  const getState = await worker.client.preferences.getConsentState(
    ConsentEntityType.InboxId,
    memberInboxId,
  );

  await worker.client.preferences.setConsentStates([
    {
      entity: memberInboxId,
      entityType: ConsentEntityType.InboxId,
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
    content?: {
      addedInboxes?: Array<{ inboxId: string }>;
      initiatedByInboxId?: string;
    };
  };

  // Return the first added inbox ID, or empty string if none
  const addedInboxes = event.content?.addedInboxes || [];
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
  count: number;
  randomSuffix?: string;
  participantsForStats: Worker[];
}) {
  await sleep(1000);
  const {
    receivers,
    startCollectors,
    getKey,
    getMessage,
    statsLabel,
    count,
    randomSuffix,
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
    msgs.map((m) => extractContent(m.event)),
  );
  let stats;
  if (randomSuffix && messagesAsStrings.length > 0) {
    stats = calculateMessageStats(
      messagesAsStrings,
      statsLabel,
      count,
      randomSuffix,
    );
  }
  // Unescape messages for output
  const unescapedMessages = unescapeMessages(
    allReceived.map((msgs) =>
      msgs.map((m) => JSON.stringify({ event: m.event })),
    ),
  );
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
  const allResults = {
    stats,
    allReceived: allReceived.every((msgs) => msgs.length === count),
    receiverCount: allReceived.length,
    messages: unescapedMessages,
    eventTimings: eventTimingsArray,
    averageEventTiming,
  };
  //console.debug(JSON.stringify(allResults, null, 2));
  return allResults;
}

/**
 * Specialized function to verify message streams
 */
export async function verifyMessageStream(
  group: Conversation,
  participants: Worker[],
  count = 1,
  randomSuffix: string = "gm",
): Promise<VerifyStreamResult> {
  const receivers = await filterReceivers(group as Group, participants);
  return collectAndTimeEventsWithStats({
    receivers,
    startCollectors: (r) => r.worker.collectMessages(group.id, count),
    triggerEvents: async () => {
      const sent: { content: string; sentAt: number }[] = [];
      for (let i = 0; i < count; i++) {
        const content = `gm-${i + 1}-${randomSuffix}`;
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
    randomSuffix,
    participantsForStats: participants,
  });
}

const filterReceivers = async (group: Group, participants: Worker[]) => {
  const creatorId = (await group.metadata()).creatorInboxId;
  return participants.filter((p) => p.client?.inboxId !== creatorId);
};

/**
 * Specialized function to verify group update streams
 */
export async function verifyMetadataStream(
  group: Group,
  participants: Worker[],
  count = 1,
  randomSuffix: string = "gm",
): Promise<VerifyStreamResult> {
  const receivers = await filterReceivers(group, participants);

  return collectAndTimeEventsWithStats({
    receivers,
    startCollectors: (r) => r.worker.collectGroupUpdates(group.id, count),
    triggerEvents: async () => {
      const sent: { name: string; sentAt: number }[] = [];
      for (let i = 0; i < count; i++) {
        const name = `New name-${i + 1}-${randomSuffix}`;
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
    randomSuffix,
    participantsForStats: participants,
  });
}

/**
 * Specialized function to verify group membership streams
 */
export async function verifyMembershipStream(
  group: Group,
  participants: Worker[],
  membersToAdd: string[],
): Promise<VerifyStreamResult> {
  const receivers = await filterReceivers(group, participants);

  return collectAndTimeEventsWithStats({
    receivers,
    startCollectors: (r) => r.worker.collectGroupUpdates(group.id, 1),
    triggerEvents: async () => {
      const sent: { inboxId: string; sentAt: number }[] = [];
      const sentAt = Date.now();
      await group.addMembers(membersToAdd);
      console.debug("member added", membersToAdd);
      sent.push({ inboxId: membersToAdd[0], sentAt });
      return sent;
    },
    getKey: extractAddedInboxes,
    getMessage: extractAddedInboxes,
    statsLabel: "member-add:",
    count: 1,
    randomSuffix: "",
    participantsForStats: participants,
  });
}

/**
 * Specialized function to verify consent streams
 */
export async function verifyGroupConsentStream(
  group: Group,
  participants: Worker[],
): Promise<VerifyStreamResult> {
  return collectAndTimeEventsWithStats({
    receivers: participants,
    startCollectors: (r) => r.worker.collectConsentUpdates(1),
    triggerEvents: async () => {
      const sentAt = Date.now();
      for (const p of participants) {
        await updateGroupConsent(p.client, group);
      }
      return [{ key: "consent", sentAt }];
    },
    getKey: (ev) => (ev as { key?: string }).key ?? "consent",
    getMessage: (ev) => (ev as { key?: string }).key ?? "consent",
    statsLabel: "consent:",
    count: 1,
    randomSuffix: "",
    participantsForStats: participants,
  });
}
/**
 * Specialized function to verify consent streams
 */
export async function verifyConsentStream(
  initiator: Worker,
  receiver: Worker,
): Promise<VerifyStreamResult> {
  return collectAndTimeEventsWithStats({
    receivers: [initiator],
    startCollectors: (r) => r.worker.collectConsentUpdates(1),
    triggerEvents: async () => {
      const sentAt = Date.now();
      await updateInboxConsent(initiator, receiver.client.inboxId);
      return [{ key: "consent", sentAt }];
    },
    getKey: (ev) => (ev as { key?: string }).key ?? "consent",
    getMessage: (ev) => (ev as { key?: string }).key ?? "consent",
    statsLabel: "consent:",
    count: 1,
    randomSuffix: "",
    participantsForStats: [initiator],
  });
}

/**
 * Verifies conversation streaming functionality
 */
export async function verifyConversationStream(
  initiator: Worker,
  participants: Worker[],
): Promise<VerifyStreamResult> {
  if (!initiator.client || !initiator.worker) {
    throw new Error(`Initiator ${initiator.name} has no client`);
  }
  return collectAndTimeEventsWithStats({
    receivers: participants,
    startCollectors: (r) =>
      r.worker.collectConversations(initiator.client.inboxId, 1),
    triggerEvents: async () => {
      const participantAddresses = participants.map((p) => {
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
    randomSuffix: "",
    participantsForStats: participants,
  });
}

/**
 * Verifies conversation streaming functionality for group member additions
 */
export async function verifyNewConversationStream(
  group: Group,
  participants: Worker[],
): Promise<VerifyStreamResult> {
  const receivers = await filterReceivers(group, participants);
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
    randomSuffix: "",
    participantsForStats: participants,
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
  const stats = {
    receptionPercentage,
    orderPercentage,
    workersInOrder,
    workerCount,
    totalReceivedMessages,
    totalExpectedMessages,
  };
  return stats;
}

// Utility to unescape a 2D array of JSON strings into objects
export function unescapeMessages(messagesAsStrings: string[][]): unknown[][] {
  return messagesAsStrings.map((arr) =>
    arr.map((str) => JSON.parse(str) as unknown),
  );
}
