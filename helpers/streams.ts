import type { Worker } from "@workers/manager";
import {
  ConsentEntityType,
  ConsentState,
  type Conversation,
  type Group,
} from "@xmtp/node-sdk";
import { sleep } from "./tests";

// Define types for message and group update structures
interface StreamMessage {
  type: string;
  message: {
    conversationId: string;
    content: string;
    contentType?: {
      typeId: string;
    };
  };
}

interface GroupUpdateMessage {
  type: string;
  group: {
    conversationId: string;
    name: string;
  };
}

// Define type for conversation notification
interface ConversationNotification {
  type: string;
  conversation: {
    id: string;
    peerAddress?: string;
  };
}

// Define the expected return type of verifyMessageStream
export type VerifyStreamResult = {
  allReceived: boolean;
  messages: string[][];
  receiverCount: number;
  stats?: {
    receptionPercentage: number;
    orderPercentage: number;
    workersInOrder: number;
    workerCount: number;
    totalReceivedMessages: number;
    totalExpectedMessages: number;
  };
};

/**
 * Generic function to verify and return stats for stream data
 * This function processes collected promises and returns statistics
 */
const verifyAndReturnStats = async <T>(
  workers: Worker[],
  collectPromises: Promise<T[]>[],
  count: number,
  randomSuffix?: string,
): Promise<VerifyStreamResult> => {
  const streamCollectedMessages = await Promise.all(collectPromises);
  const streamAllReceived = streamCollectedMessages.every(
    (msgs) => msgs?.length === count,
  );

  // Convert any type to string arrays for stats calculation
  const messagesAsStrings = streamCollectedMessages.map((msgs) =>
    msgs.map((m) => String(m)),
  );

  // Only calculate stats if we have a randomSuffix (for message ordering)
  // and if there are actual messages to process
  let stats;
  if (randomSuffix && messagesAsStrings.length > 0) {
    stats = calculateMessageStats(
      workers,
      messagesAsStrings,
      "gm-",
      count,
      randomSuffix,
    );

    // Only validate stats if we have actual messages
    console.log(JSON.stringify(stats));
  } else {
    console.log(`Received ${messagesAsStrings.flat().length} messages total`);
  }
  const result = {
    stats,
    allReceived: streamAllReceived,
    receiverCount: streamCollectedMessages.length,
    messages: messagesAsStrings,
  };
  console.log("result", JSON.stringify(result));
  return result;
};

/**
 * Toggle the consent state for an entity
 */
export async function toggleConsentState(
  worker: Worker,
  entity: string,
  entityType: ConsentEntityType,
  initialState?: ConsentState,
): Promise<ConsentState> {
  // If no initial state provided, get it first
  let currState = initialState;
  if (currState === undefined) {
    currState = await worker.client.preferences.getConsentState(
      entityType,
      entity,
    );
  }

  // Toggle the state
  const newState =
    currState === ConsentState.Allowed
      ? ConsentState.Denied
      : ConsentState.Allowed;

  console.log(
    `Changing consent state to ${newState === ConsentState.Allowed ? "allowed" : "denied"}`,
  );

  // Apply the state change
  await worker.client.preferences.setConsentStates([
    {
      entity,
      entityType,
      state: newState,
    },
  ]);

  return newState;
}

/**
 * Create a consent sender function for DM conversations
 */
export function createDmConsentSender(
  worker: Worker,
  targetInboxId: string,
  initialState?: ConsentState,
) {
  return async (): Promise<string> => {
    await toggleConsentState(
      worker,
      targetInboxId,
      ConsentEntityType.InboxId,
      initialState,
    );
    return "consent_updated";
  };
}

/**
 * Create a group consent sender that blocks both the group and a specific member
 */
export function createGroupConsentSender(
  worker: Worker,
  groupId: string,
  memberInboxId: string,
  blockEntities = true,
) {
  return async (): Promise<string> => {
    console.log(
      `Setting group consent to ${blockEntities ? "DENIED" : "ALLOWED"}`,
    );

    const consentState = blockEntities
      ? ConsentState.Denied
      : ConsentState.Allowed;

    // Set consent for the group
    await worker.client.preferences.setConsentStates([
      {
        entity: groupId,
        entityType: ConsentEntityType.GroupId,
        state: consentState,
      },
    ]);

    // Also set consent for the specific member
    await worker.client.preferences.setConsentStates([
      {
        entity: memberInboxId,
        entityType: ConsentEntityType.InboxId,
        state: consentState,
      },
    ]);

    return "group_consent_updated";
  };
}

/**
 * Specialized function to verify message streams
 */
export async function verifyMessageStream(
  group: Conversation,
  participants: Worker[],
  count = 1,
  randomSuffix: string = "gm",
): Promise<
  VerifyStreamResult & {
    messageTimings: Record<string, Record<number, number>>;
  }
> {
  const receivers = await filterReceivers(group as Group, participants);

  // 1. Prepare to record send times
  const sentMessages: { content: string; sentAt: number }[] = Array.from(
    { length: count },
    (_, i) => ({ content: `gm-${i + 1}-${randomSuffix}`, sentAt: 0 }),
  );

  // 2. For each participant, collect messages and record receive time (start collectors BEFORE sending)
  const collectPromises: Promise<{ content: string; receivedAt: number }[]>[] =
    receivers.map((r) => {
      return r.worker
        .collectMessages(group.id, count, 20000)
        .then((msgs: StreamMessage[]) => {
          // For each received message, record content and receive time
          return msgs.map((m) => ({
            content: m.message.content,
            receivedAt: Date.now(),
          }));
        })
        .catch((err: unknown) => {
          console.error(`Error collecting messages for ${r.name}:`, err);
          return [] as { content: string; receivedAt: number }[];
        });
    });

  // 3. Send messages and record send time
  for (let i = 0; i < count; i++) {
    console.log(`Sending message ${i + 1} of ${count}`);
    sentMessages[i].sentAt = Date.now();
    await group.send(sentMessages[i].content);
  }

  // 4. Wait for all messages to be collected
  const allReceived = await Promise.all(collectPromises);

  // 5. Calculate timings: for each participant, for each message, duration = receivedAt - sentAt
  const messageTimings: Record<string, Record<number, number>> = {};
  receivers.forEach((r, idx) => {
    const received = allReceived[idx];
    messageTimings[r.name] = {};
    received.forEach((msg) => {
      // Find the sent message index by content
      const sentIdx = sentMessages.findIndex((s) => s.content === msg.content);
      if (sentIdx !== -1) {
        messageTimings[r.name][sentIdx] =
          msg.receivedAt - sentMessages[sentIdx].sentAt;
      }
    });
  });

  // 6. Prepare messages as strings for stats
  const messagesAsStrings = allReceived.map((msgs) =>
    msgs.map((m) => m.content),
  );

  // 7. Calculate stats as before
  let stats;
  if (randomSuffix && messagesAsStrings.length > 0) {
    stats = calculateMessageStats(
      participants,
      messagesAsStrings,
      "gm-",
      count,
      randomSuffix,
    );
    console.log(JSON.stringify(stats));
  } else {
    console.log(`Received ${messagesAsStrings.flat().length} messages total`);
  }
  const result = {
    stats,
    allReceived: allReceived.every((msgs) => msgs.length === count),
    receiverCount: allReceived.length,
    messages: messagesAsStrings,
    messageTimings,
  };
  console.log("result", JSON.stringify(result));
  return result;
}

const filterReceivers = async (group: Group, participants: Worker[]) => {
  console.log("Waiting for 1 second before starting stream");
  await sleep(1000);
  const creatorId = (await group.metadata()).creatorInboxId;
  return participants.filter((p) => p.client?.inboxId !== creatorId);
};

/**
 * Specialized function to verify group update streams
 */
export async function verifyGroupUpdateStream(
  group: Group,
  participants: Worker[],
  count = 1,
  randomSuffix: string = "gm",
): Promise<
  VerifyStreamResult & { eventTimings: Record<string, Record<number, number>> }
> {
  const receivers = await filterReceivers(group, participants);

  // 1. Prepare to record send times
  const updateNames: { name: string; sentAt: number }[] = Array.from(
    { length: count },
    (_, i) => ({ name: `New name-${i + 1}-${randomSuffix}`, sentAt: 0 }),
  );

  // 2. Start collectors before triggering updates
  const collectPromises: Promise<{ name: string; receivedAt: number }[]>[] =
    receivers.map((r) => {
      return r.worker
        .collectGroupUpdates(group.id, count, 20000)
        .then((msgs: GroupUpdateMessage[]) => {
          return msgs.map((m) => ({
            name: m.group.name,
            receivedAt: Date.now(),
          }));
        })
        .catch((err: unknown) => {
          console.error(`Error collecting group updates for ${r.name}:`, err);
          return [] as { name: string; receivedAt: number }[];
        });
    });

  // 3. Trigger group updates and record send time
  for (let i = 0; i < count; i++) {
    await group.updateName(updateNames[i].name);
    console.log(`Updated group name to ${updateNames[i].name}`);
    updateNames[i].sentAt = Date.now();
  }

  // 4. Wait for all updates to be collected
  const allReceived = await Promise.all(collectPromises);

  // 5. Calculate timings
  const eventTimings: Record<string, Record<number, number>> = {};
  receivers.forEach((r, idx) => {
    const received = allReceived[idx];
    eventTimings[r.name] = {};
    received.forEach((msg) => {
      const sentIdx = updateNames.findIndex((s) => s.name === msg.name);
      if (sentIdx !== -1) {
        eventTimings[r.name][sentIdx] =
          msg.receivedAt - updateNames[sentIdx].sentAt;
      }
    });
  });

  // Prepare messages as strings for stats
  const messagesAsStrings = allReceived.map((msgs) => msgs.map((m) => m.name));

  let stats;
  if (randomSuffix && messagesAsStrings.length > 0) {
    stats = calculateMessageStats(
      participants,
      messagesAsStrings,
      "New name-",
      count,
      randomSuffix,
    );
    console.log(JSON.stringify(stats));
  } else {
    console.log(
      `Received ${messagesAsStrings.flat().length} group updates total`,
    );
  }
  const result = {
    stats,
    allReceived: allReceived.every((msgs) => msgs.length === count),
    receiverCount: allReceived.length,
    messages: messagesAsStrings,
    eventTimings,
  };
  console.log("result", JSON.stringify(result));
  return result;
}

/**
 * Specialized function to verify consent streams
 */
export async function verifyConsentStream(
  initiator: Worker,
  participants: Worker[],
  action: (inboxId?: string, groupId?: string) => Promise<void>,
): Promise<
  VerifyStreamResult & { eventTimings: Record<string, Record<number, number>> }
> {
  console.log("Waiting for 1 second before starting consent stream test");
  await sleep(1000);

  // Start collector before triggering action
  const startTime = Date.now();
  const consentPromise = initiator.worker
    .collectConsentUpdates(1)
    .then((updates) => {
      console.log(`Collected consent updates:`, JSON.stringify(updates));
      return updates.length > 0
        ? [
            {
              key: `consent:${updates[0].consentUpdate.inboxId}:${updates[0].consentUpdate.consentValue ? "allowed" : "denied"}`,
              receivedAt: Date.now(),
            },
          ]
        : [];
    })
    .catch((err: unknown) => {
      console.error(
        `[CONSENT-COLLECTOR] Error collecting consent events:`,
        err,
      );
      return [] as { key: string; receivedAt: number }[];
    });

  // Trigger the action and record send time
  const actionSentAt = Date.now();
  await action();

  // Wait for consent event
  const allReceived = await Promise.all([consentPromise]);

  // Calculate timings
  const eventTimings: Record<string, Record<number, number>> = {};
  eventTimings[initiator.name] = {};
  allReceived[0].forEach((msg, idx) => {
    eventTimings[initiator.name][idx] = msg.receivedAt - actionSentAt;
  });

  // Prepare messages as strings for stats
  const messagesAsStrings = allReceived.map((msgs) => msgs.map((m) => m.key));

  let stats;
  if (messagesAsStrings.length > 0) {
    stats = calculateMessageStats(
      [initiator],
      messagesAsStrings,
      "consent:",
      1,
      "",
    );
    console.log(JSON.stringify(stats));
  } else {
    console.log(
      `Received ${messagesAsStrings.flat().length} consent events total`,
    );
  }
  const result = {
    stats,
    allReceived: allReceived.every((msgs) => msgs.length === 1),
    receiverCount: allReceived.length,
    messages: messagesAsStrings,
    eventTimings,
  };
  console.log("result", JSON.stringify(result));
  return result;
}

/**
 * Verifies conversation streaming functionality
 */
export async function verifyConversationStream(
  initiator: Worker,
  participants: Worker[],
): Promise<
  VerifyStreamResult & { eventTimings: Record<string, Record<number, number>> }
> {
  console.log("Waiting for 1 second before starting conversation stream test");
  await sleep(1000);
  if (!initiator.client || !initiator.worker) {
    throw new Error(`Initiator ${initiator.name} not properly initialized`);
  }

  console.log(
    `[${initiator.name}] Starting group conversation stream test with ${participants.length} participants`,
  );

  // Start collectors before creating group
  const participantPromises: Promise<{ id: string; receivedAt: number }[]>[] =
    participants.map((participant) => {
      return participant.worker
        .collectConversations(initiator.client.inboxId, 1, 20000)
        .then((msgs: ConversationNotification[]) => {
          return msgs.map((msg) => ({
            id: msg.conversation.id,
            receivedAt: Date.now(),
          }));
        });
    });

  // Get participant addresses and create group
  const participantAddresses = participants.map((p) => {
    if (!p.client) throw new Error(`Participant ${p.name} has no client`);
    return p.client.inboxId;
  });

  // Record send time
  const sentAt = Date.now();
  const createdGroup =
    await initiator.client.conversations.newGroup(participantAddresses);
  console.log(`[${initiator.name}] Created group: ${createdGroup.id}`);

  // Wait for all notifications to be collected
  const allReceived = await Promise.all(participantPromises);

  // Calculate timings
  const eventTimings: Record<string, Record<number, number>> = {};
  participants.forEach((p, idx) => {
    const received = allReceived[idx];
    eventTimings[p.name] = {};
    received.forEach((msg, j) => {
      eventTimings[p.name][j] = msg.receivedAt - sentAt;
    });
  });

  // Prepare messages as strings for stats
  const messagesAsStrings = allReceived.map((msgs) => msgs.map((m) => m.id));

  let stats;
  if (messagesAsStrings.length > 0) {
    stats = calculateMessageStats(
      participants,
      messagesAsStrings,
      "conversation:",
      1,
      "",
    );
    console.log(JSON.stringify(stats));
  } else {
    console.log(
      `Received ${messagesAsStrings.flat().length} conversation events total`,
    );
  }
  const result = {
    stats,
    allReceived: allReceived.every((msgs) => msgs.length === 1),
    receiverCount: allReceived.length,
    messages: messagesAsStrings,
    eventTimings,
  };
  console.log("result", JSON.stringify(result));
  return result;
}

/**
 * Verifies conversation streaming functionality for group member additions
 */
export async function verifyAddMembersStream(
  group: Group,
  participants: Worker[],
): Promise<
  VerifyStreamResult & { eventTimings: Record<string, Record<number, number>> }
> {
  // Filter out the initiator from participants for the check
  const receivers = await filterReceivers(group, participants);
  console.log(
    `[${group.id}] Workers listening for conversation updates:`,
    receivers.map((r) => r.name),
  );
  const creatorInboxId = (await group.metadata()).creatorInboxId;
  // Start collectors before adding members
  const participantPromises: Promise<{ id: string; receivedAt: number }[]>[] =
    receivers.map((participant) => {
      return participant.worker
        .collectConversations(creatorInboxId, 1, 20000)
        .then((msgs: ConversationNotification[]) => {
          return msgs.map((msg) => ({
            id: msg.conversation.id,
            receivedAt: Date.now(),
          }));
        });
    });

  // Record send time
  const sentAt = Date.now();
  await group.addMembers(receivers.map((r) => r.client?.inboxId));
  console.log(`Added ${receivers.length} members to group ${group.id}`);

  // Wait for all notifications to be collected
  const allReceived = await Promise.all(participantPromises);

  // Calculate timings
  const eventTimings: Record<string, Record<number, number>> = {};
  receivers.forEach((r, idx) => {
    const received = allReceived[idx];
    eventTimings[r.name] = {};
    received.forEach((msg, j) => {
      eventTimings[r.name][j] = msg.receivedAt - sentAt;
    });
  });

  // Prepare messages as strings for stats
  const messagesAsStrings = allReceived.map((msgs) => msgs.map((m) => m.id));

  let stats;
  if (messagesAsStrings.length > 0) {
    stats = calculateMessageStats(
      receivers,
      messagesAsStrings,
      "conversation:",
      1,
      "",
    );
    console.log(JSON.stringify(stats));
  } else {
    console.log(
      `Received ${messagesAsStrings.flat().length} add member events total`,
    );
  }
  const result = {
    stats,
    allReceived: allReceived.every((msgs) => msgs.length === 1),
    receiverCount: allReceived.length,
    messages: messagesAsStrings,
    eventTimings,
  };
  console.log("result", JSON.stringify(result));
  return result;
}

/**
 * Calculates message reception and order statistics
 */
export function calculateMessageStats(
  workers: Worker[],
  messagesByWorker: string[][],
  prefix: string,
  amount: number,
  suffix: string,
) {
  // Verify message order helper
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

  // Log discrepancies helper
  const showDiscrepancies = (
    workersInOrder: number,
    workerCount: number,
    workers: Worker[],
  ) => {
    if (workersInOrder >= workerCount) return;

    console.log("Message order discrepancies detected:");

    messagesByWorker.forEach((messages, index) => {
      const { inOrder, expectedMessages } = verifyMessageOrder(
        messages,
        prefix,
        amount,
      );

      if (!inOrder) {
        console.log(
          `Worker ${workers[index].name} received messages out of order or missing messages:`,
        );

        if (messages.length !== expectedMessages.length) {
          console.log(
            `  Expected ${expectedMessages.length} messages, received ${messages.length}`,
          );
        }

        const discrepancies = [];

        for (
          let i = 0;
          i < Math.max(messages.length, expectedMessages.length);
          i++
        ) {
          if (i >= messages.length) {
            discrepancies.push(`Missing: ${expectedMessages[i]}`);
          } else if (i >= expectedMessages.length) {
            discrepancies.push(`Unexpected: ${messages[i]}`);
          } else if (messages[i] !== expectedMessages[i]) {
            discrepancies.push(
              `Expected: ${expectedMessages[i]}, Got: ${messages[i]}`,
            );
          }
        }

        if (discrepancies.length > 0) {
          console.debug("Discrepancies:");
          discrepancies.forEach((d) => {
            console.debug(d);
          });
        }
      }
    });
  };

  // Calculate statistics
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

  console.log("Expected messages pattern:", `${prefix}[1-${amount}]-${suffix}`);
  console.log(
    `Reception: ${receptionPercentage.toFixed(2)}% (${totalReceivedMessages}/${totalExpectedMessages})`,
  );
  console.log(
    `Order: ${orderPercentage.toFixed(2)}% (${workersInOrder}/${workerCount} workers)`,
  );

  showDiscrepancies(workersInOrder, workerCount, workers);

  const stats = {
    receptionPercentage,
    orderPercentage,
    workersInOrder,
    workerCount,
    totalReceivedMessages,
    totalExpectedMessages,
  };
  console.log("stats", JSON.stringify(stats));
  return stats;
}
