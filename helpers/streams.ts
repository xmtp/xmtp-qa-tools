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
  onActionStarted?: () => void,
): Promise<VerifyStreamResult> {
  console.log("Waiting for 1 second before starting message stream test");
  await sleep(1000);
  const creatorId = (await group.metadata()).creatorInboxId;
  const receivers = participants.filter((p) => p.client?.inboxId !== creatorId);

  // Configure collectors for message streams with timeout
  console.log(`Setting up ${receivers.length} collectors for messages`);
  const collectPromises: Promise<string[]>[] = receivers.map((r) => {
    return r.worker
      .collectMessages(group.id, count, 20000) // 20 second timeout
      .then((msgs: StreamMessage[]) => {
        return msgs.map((m) => m.message.content);
      })
      .catch((err: unknown) => {
        console.error(`Error collecting messages for ${r.name}:`, err);
        return [] as string[];
      });
  });

  // Generate all messages first for consistent handling
  const sentMessages: string[] = Array.from(
    { length: count },
    (_, i) => `gm-${i + 1}-${randomSuffix}`,
  );

  // Send messages with optional callback after first message
  for (let i = 0; i < count; i++) {
    console.log(`Sending message ${i + 1} of ${count}`);
    await group.send(sentMessages[i]);
    if (i === 0 && onActionStarted) {
      onActionStarted();
    }
  }

  return verifyAndReturnStats<string>(
    participants,
    collectPromises,
    count,
    randomSuffix,
  );
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
  onActionStarted?: () => void,
): Promise<VerifyStreamResult> {
  const receivers = await filterReceivers(group, participants);

  // Configure collectors for group update streams with timeout
  console.log(`Setting up ${receivers.length} collectors for group updates`);
  const collectPromises: Promise<string[]>[] = receivers.map((r) => {
    console.log(`Setting up collector for ${r.name} to watch ${group.id}`);

    return r.worker
      .collectGroupUpdates(group.id, count, 20000) // 20 second timeout
      .then((msgs: GroupUpdateMessage[]) => {
        console.log(
          `Received group updates for ${r.name}:`,
          JSON.stringify(msgs),
        );
        return msgs.length > 0 ? msgs.map((m) => m.group.name) : [];
      })
      .catch((err: unknown) => {
        console.error(`Error collecting group updates for ${r.name}:`, err);
        return [] as string[];
      });
  });

  // Generate all update names first for consistent handling
  const updateNames: string[] = Array.from(
    { length: count },
    (_, i) => `New name-${i + 1}-${randomSuffix}`,
  );

  // Perform group updates with optional callback after first update
  for (let i = 0; i < count; i++) {
    await group.updateName(updateNames[i]);
    console.log(`Updated group name to ${updateNames[i]}`);

    if (i === 0 && onActionStarted) {
      onActionStarted();
    }
  }

  return verifyAndReturnStats<string>(
    participants,
    collectPromises,
    count,
    randomSuffix,
  );
}

/**
 * Specialized function to verify consent streams
 */
export async function verifyConsentStream(
  initiator: Worker,
  participants: Worker[],
  action: (inboxId?: string, groupId?: string) => Promise<void>,
  onActionStarted?: () => void,
): Promise<VerifyStreamResult> {
  console.log("Waiting for 1 second before starting consent stream test");
  await sleep(1000);
  console.log(
    `Setting up ${participants.length} collectors for consent events`,
  );

  // Start collecting consent updates from the initiator who will be receiving the updates
  console.log(`Setting up consent collector for ${initiator.name}`);

  // Use a promise to collect consent events using the built-in method
  const consentPromise = initiator.worker
    .collectConsentUpdates(1)
    .then((updates) => {
      console.log(`Collected consent updates:`, JSON.stringify(updates));
      return updates.length > 0
        ? [
            `consent:${updates[0].consentUpdate.inboxId}:${updates[0].consentUpdate.consentValue ? "allowed" : "denied"}`,
          ]
        : ["no_consent_events_collected"];
    })
    .catch((err: unknown) => {
      console.error(
        `[CONSENT-COLLECTOR] Error collecting consent events:`,
        err,
      );
      return ["error_collecting_consent"];
    });

  await action();
  if (onActionStarted) {
    onActionStarted();
  }

  // No randomSuffix for consent events as they don't follow the same pattern
  return verifyAndReturnStats([initiator], [consentPromise], 1, "");
}

/**
 * Verifies conversation streaming functionality
 */
export async function verifyConversationStream(
  initiator: Worker,
  participants: Worker[],
  onActionStarted?: () => void,
): Promise<VerifyStreamResult> {
  console.log("Waiting for 1 second before starting conversation stream test");
  await sleep(1000);
  if (!initiator.client || !initiator.worker) {
    throw new Error(`Initiator ${initiator.name} not properly initialized`);
  }

  console.log(
    `[${initiator.name}] Starting group conversation stream test with ${participants.length} participants`,
  );

  // Set up collector promises with a longer timeout (20 seconds)
  const participantPromises: Promise<string[]>[] = participants.map(
    (participant) => {
      if (!participant.worker) {
        console.warn(`Participant ${participant.name} has no worker`);
        return Promise.resolve<string[]>([]);
      }

      return participant.worker
        .collectConversations(initiator.client.inboxId, 1, 20000) // 20 second timeout
        .then((msgs: ConversationNotification[]) => {
          return msgs.map((msg) => `conversation:${msg.conversation.id}`);
        })
        .catch((err: unknown) => {
          console.error(
            `Error collecting conversations for ${participant.name}:`,
            err,
          );
          return [];
        });
    },
  );

  // Get participant addresses and create group
  const participantAddresses = participants.map((p) => {
    if (!p.client) throw new Error(`Participant ${p.name} has no client`);
    return p.client.inboxId;
  });

  const createdGroup =
    await initiator.client.conversations.newGroup(participantAddresses);
  console.log(`[${initiator.name}] Created group: ${createdGroup.id}`);

  if (onActionStarted) {
    onActionStarted();
  }

  return verifyAndReturnStats(participants, participantPromises, 1, "");
}

/**
 * Verifies conversation streaming functionality for group member additions
 */
export async function verifyConversationGroupStream(
  group: Group,
  initiator: Worker,
  participants: Worker[],
  onActionStarted?: () => void,
): Promise<VerifyStreamResult> {
  console.log(
    "Waiting for 1 second before starting conversation group stream test",
  );
  await sleep(1000);
  if (!initiator.client || !initiator.worker) {
    throw new Error(`Initiator ${initiator.name} not properly initialized`);
  }

  console.log(
    `[${initiator.name}] Starting group conversation stream test with ${participants.length} participants`,
  );

  // Filter out the initiator from participants for the check
  const nonInitiatorParticipants = participants.filter(
    (p) => p.name !== initiator.name,
  );

  console.log(
    `Expecting notifications for ${nonInitiatorParticipants.length} participants (excluding initiator ${initiator.name})`,
  );

  // Set up collector promises with a longer timeout (20 seconds)
  const participantPromises: Promise<string[]>[] = participants.map(
    (participant) => {
      if (!participant.worker) {
        console.warn(`Participant ${participant.name} has no worker`);
        return Promise.resolve<string[]>([]);
      }

      return participant.worker
        .collectConversations(initiator.client.inboxId, 1, 20000) // 20 second timeout
        .then((msgs: ConversationNotification[]) => {
          return msgs.map((msg) => `conversation:${msg.conversation.id}`);
        })
        .catch((err: unknown) => {
          console.error(
            `Error collecting conversations for ${participant.name}:`,
            err,
          );
          return [];
        });
    },
  );

  // Add members to the group
  await group.addMembers(participants.map((p) => p.client.inboxId));
  console.log(`Added ${participants.length} members to group ${group.id}`);

  if (onActionStarted) {
    onActionStarted();
  }

  // No randomSuffix for conversation notifications
  return verifyAndReturnStats(participants, participantPromises, 1, "");
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
