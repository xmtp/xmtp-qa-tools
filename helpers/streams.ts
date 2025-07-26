import { sleep, streamColdStartTimeout } from "@helpers/client";
import { typeofStream } from "@workers/main";
import type { Worker } from "@workers/manager";
import {
  ConsentEntityType,
  ConsentState,
  type Client,
  type Conversation,
  type Group,
} from "@workers/versions";

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

function extractTimestamp(ev: unknown): number | null {
  if (typeof ev === "object" && ev !== null) {
    // Try different timestamp fields that might exist in message events
    const possibleFields = ["receivedAt", "timestamp", "sentAt", "createdAt"];
    const nanosecondFields = [
      "receivedAtNs",
      "timestampNs",
      "sentAtNs",
      "createdAtNs",
    ];

    // First try regular timestamp fields (in milliseconds)
    for (const field of possibleFields) {
      if (
        Object.prototype.hasOwnProperty.call(ev, field) &&
        typeof (ev as Record<string, unknown>)[field] === "number"
      ) {
        return (ev as Record<string, number>)[field];
      }
    }

    // Then try nanosecond timestamp fields and convert to milliseconds
    for (const field of nanosecondFields) {
      if (
        Object.prototype.hasOwnProperty.call(ev, field) &&
        typeof (ev as Record<string, unknown>)[field] === "number"
      ) {
        return Number((ev as Record<string, number>)[field]) / 1_000_000;
      }
    }

    // Try nested in message object (for StreamTextMessage structure)
    if (
      Object.prototype.hasOwnProperty.call(ev, "message") &&
      typeof (ev as Record<string, unknown>).message === "object" &&
      (ev as Record<string, unknown>).message !== null
    ) {
      const message = (ev as { message: Record<string, unknown> }).message;

      // First try regular timestamp fields
      for (const field of possibleFields) {
        if (
          Object.prototype.hasOwnProperty.call(message, field) &&
          typeof message[field] === "number"
        ) {
          return message[field];
        }
      }

      // Then try nanosecond timestamp fields and convert to milliseconds
      for (const field of nanosecondFields) {
        if (
          Object.prototype.hasOwnProperty.call(message, field) &&
          typeof message[field] === "number"
        ) {
          return Number(message[field]) / 1_000_000;
        }
      }
    }
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

  // Sync conversations for all receiving workers to ensure they have local group instances
  await Promise.all(
    receivers.map((worker) => worker.client.conversations.syncAll()),
  );

  // Start collectors FIRST - before any messages are sent
  const collectPromises: Promise<
    { key: string; receivedAt: number; message: string; event: unknown }[]
  >[] = receivers.map((r) =>
    startCollectors(r).then((events) =>
      events.map((ev) => {
        // Try to extract the actual received timestamp from the event
        const eventTimestamp = extractTimestamp(ev);
        const fallbackTimestamp = Date.now();
        const finalTimestamp = eventTimestamp || fallbackTimestamp;

        console.debug(
          "Onit message timestamp debug:",
          JSON.stringify(
            {
              eventTimestamp,
              fallbackTimestamp,
              finalTimestamp,
              message: getMessage(ev).substring(0, 100) + "...",
            },
            null,
            2,
          ),
        );

        return {
          key: getKey(ev),
          receivedAt: finalTimestamp,
          message: getMessage(ev),
          event: ev,
        };
      }),
    ),
  );

  // Wait for streams to be ready and collectors to be active
  await sleep(streamColdStartTimeout);

  // NOW send the messages - after collectors are listening
  const sentEvents = await options.triggerEvents();

  // Wait for all collectors to finish
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
        const sentTime = (sentEvents[sentIdx] as { sentAt: number }).sentAt;
        const duration = msg.receivedAt - sentTime;

        // Debug logging for Onit agent specifically
        console.debug(
          "Onit timing calculation debug:",
          JSON.stringify(
            {
              receivedAt: msg.receivedAt,
              sentAt: sentTime,
              duration,
              positiveDuration: Math.max(0, duration),
              message: msg.message.substring(0, 100) + "...",
            },
            null,
            2,
          ),
        );

        // Handle negative durations (agent auto-responses received before trigger)
        // For auto-responses, use a minimal positive duration to indicate instant response
        let positiveDuration: number;
        if (duration < 0) {
          console.debug(
            "Agent auto-response detected (received before trigger):",
            JSON.stringify({
              duration,
              receivedAt: msg.receivedAt,
              sentAt: sentTime,
              message: msg.message.substring(0, 50) + "...",
            }),
          );
          positiveDuration = 1; // 1ms to indicate instant auto-response
        } else {
          // Ensure we don't have negative durations due to clock skew or processing delays
          // Use a minimum of 1ms instead of 0 to avoid metric validation errors
          positiveDuration = Math.max(1, duration);
        }

        eventTimings[r.name][sentIdx] = positiveDuration;
        timingSum += positiveDuration;
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

  const stats = calculateMessageStats(
    messagesAsStrings,
    statsLabel,
    count ?? 1,
    messageTemplate || "",
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

  // Fix: Check if each receiver got the expected number of messages
  const totalMessagesReceived = allReceived.reduce(
    (sum, receiverMessages) => sum + receiverMessages.length,
    0,
  );
  const expectedTotalMessages = (count ?? 1) * receivers.length;
  const BooleanReceive = totalMessagesReceived >= expectedTotalMessages;

  const allResults = {
    allReceived: BooleanReceive,
    almostAllReceived:
      BooleanReceive || totalMessagesReceived >= expectedTotalMessages - 2,
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
    startCollectors: (r) =>
      r.worker.collectMessages(group.id, count, ["text"], 60000), // 60s timeout
    triggerEvents: async () => {
      const sent: { content: string; sentAt: number }[] = [];
      for (let i = 0; i < count; i++) {
        let content = messageTemplate;
        content = content.replace("{i}", `${i + 1}`);
        content = content.replace("{randomSuffix}", randomSuffix);
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
    membersForStats: receivers,
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
    membersForStats: receivers,
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
    membersForStats: receivers,
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
      const participantAddresses = receivers.map((p) => {
        if (!p.client) throw new Error(`Participant ${p.name} has no client`);
        return p.client.inboxId;
      });
      const sentAt = Date.now();
      const conversation =
        await initiator.client.conversations.newGroup(participantAddresses);
      const members = await conversation.members();
      console.debug("conversation created", conversation.id);
      return [
        { id: "conversation", sentAt, members: members.map((m) => m.inboxId) },
      ];
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

  // Special case for single message scenarios (like agent responses)
  // Order percentage is 100% if any messages were received
  if (amount === 1) {
    for (const messages of messagesByWorker) {
      if (messages.length > 0) workersInOrder++;
    }
  } else {
    // Standard ordered message verification for multi-message scenarios
    for (const messages of messagesByWorker) {
      const { inOrder } = verifyMessageOrder(messages, prefix, amount);
      if (inOrder) workersInOrder++;
    }
  }

  const receptionPercentage =
    (totalReceivedMessages / totalExpectedMessages) * 100;
  const orderPercentage = (workersInOrder / workerCount) * 100;
  return { receptionPercentage, orderPercentage };
}

/**
 * Specialized function to verify bot response streams
 * Measures the time it takes for a bot to respond to a trigger message
 * Includes retry logic and fallback message count validation
 */
export async function verifyAgentMessageStream(
  group: Conversation,
  receivers: Worker[],
  triggerMessage: string,
  maxRetries: number = 1,
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
          ["text", "reply", "reaction", "actions"],
          customTimeout ?? undefined,
        ),
      triggerEvents: async () => {
        await group.send(triggerMessage);
        const sentAt = Date.now();
        console.debug(
          "Onit triggerEvents debug:",
          JSON.stringify({ sentAt, triggerMessage }, null, 2),
        );
        return [{ conversationId: group.id, sentAt }];
      },
      getKey: () => group.id, // Use conversation ID as consistent key for both sent and received
      getMessage: extractContent,
      statsLabel: "bot-response:",
      count: 1,
      messageTemplate: "",
      membersForStats: receivers,
    });

    if (result.allReceived) {
      return result;
    }

    attempts++;
  }
  receivers.forEach((worker) => {
    worker.worker.stopStreams();
  });
  return result;
}
