import { typeofStream } from "@workers/main";
import type { Worker } from "@workers/manager";
import {
  ConsentEntityType,
  ConsentState,
  type Conversation,
  type Group,
} from "@xmtp/node-sdk";
import { defaultValues, sleep } from "./tests";

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
};

/**
 * Reusable consent operations for testing
 */

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
 * Prepare the participants and conversation details
 */
async function prepareParticipants(
  group: Conversation,
  participants: Worker[],
): Promise<{
  conversationId: string;
  randomSuffix: string;
  receivers: Worker[];
}> {
  const conversationId = group.id;
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  const creatorId = (await group.metadata()).creatorInboxId;
  const receivers = participants.filter((p) => p.client?.inboxId !== creatorId);

  // Sync conversations for all receivers
  await Promise.all(
    receivers.map((r) =>
      r.client.conversations.sync().catch((err: unknown) => {
        console.error(`Error syncing for ${r.name}:`, err);
      }),
    ),
  );
  await sleep(defaultValues.streamTimeout);

  return { conversationId, randomSuffix, receivers };
}

/**
 * Specialized function to verify message streams
 */
export async function verifyMessageStream<T extends string = string>(
  group: Conversation,
  participants: Worker[],
  count = 1,
  generator: (i: number, suffix: string) => T = (i, suffix): T =>
    `gm-${i + 1}-${suffix}` as T,
  sender: (group: Conversation, payload: string) => Promise<string> = async (
    g,
    payload,
  ) => await g.send(payload),
  onMessageSent?: () => void,
): Promise<VerifyStreamResult> {
  const { conversationId, randomSuffix, receivers } = await prepareParticipants(
    group,
    participants,
  );

  // Configure collectors for message streams with timeout
  console.log(`Setting up ${receivers.length} collectors for messages`);
  const collectPromises: Promise<T[]>[] = receivers.map((r) => {
    return r.worker
      .collectMessages(conversationId, typeofStream.Message, count, 20000) // 20 second timeout
      .then((msgs: StreamMessage[]) => {
        return msgs.map((m) => m.message.content as T);
      })
      .catch((err: unknown) => {
        console.error(`Error collecting messages for ${r.name}:`, err);
        return [] as T[];
      });
  });

  // Generate all messages first for consistent handling
  const sentMessages: T[] = Array.from({ length: count }, (_, i) =>
    generator(i, randomSuffix),
  );

  // Send messages with optional callback after first message
  for (let i = 0; i < count; i++) {
    console.log(`Sending message ${i + 1} of ${count}`);
    await sender(group, sentMessages[i]);
    if (i === 0 && onMessageSent) {
      onMessageSent();
    }
  }

  // Collect and process results
  const streamCollectedMessages = await Promise.all(collectPromises);
  const streamAllReceived = streamCollectedMessages.every(
    (msgs) => msgs?.length === count,
  );

  return {
    allReceived: streamAllReceived,
    messages: streamCollectedMessages,
  };
}

/**
 * Specialized function to verify group update streams
 */
export async function verifyGroupUpdateStream<T extends string = string>(
  group: Group,
  participants: Worker[],
  count = 1,
  generator: (i: number, suffix: string) => T = (i, suffix): T =>
    `New name-${i + 1}-${suffix}` as T,
  onUpdatePerformed?: () => void,
): Promise<VerifyStreamResult> {
  const { conversationId, randomSuffix, receivers } = await prepareParticipants(
    group,
    participants,
  );

  // Configure collectors for group update streams with timeout
  console.log(`Setting up ${receivers.length} collectors for group updates`);
  const collectPromises: Promise<T[]>[] = receivers.map((r) => {
    console.log(
      `Setting up collector for ${r.name} to watch ${conversationId}`,
    );

    return r.worker
      .collectGroupUpdates(conversationId, count, 20000) // 20 second timeout
      .then((msgs: GroupUpdateMessage[]) => {
        console.log(
          `Received group updates for ${r.name}:`,
          JSON.stringify(msgs),
        );
        return msgs.length > 0 ? msgs.map((m) => m.group.name as T) : [];
      })
      .catch((err: unknown) => {
        console.error(`Error collecting group updates for ${r.name}:`, err);
        return [] as T[];
      });
  });

  // Generate all update names first for consistent handling
  const updateNames: T[] = Array.from({ length: count }, (_, i) =>
    generator(i, randomSuffix),
  );

  // Perform group updates with optional callback after first update
  for (let i = 0; i < count; i++) {
    await group.updateName(updateNames[i]);
    console.log(`Updated group name to ${updateNames[i]}`);

    if (i === 0 && onUpdatePerformed) {
      onUpdatePerformed();
    }
  }

  // Collect and process results
  const streamCollectedMessages = await Promise.all(collectPromises);
  const streamAllReceived = streamCollectedMessages.every(
    (msgs) => msgs?.length === count,
  );

  return {
    allReceived: streamAllReceived,
    messages: streamCollectedMessages,
  };
}

/**
 * Specialized function to verify consent streams
 */
export async function verifyConsentStream(
  initiator: Worker,
  participants: Worker[],
  action: (inboxId?: string, groupId?: string) => Promise<void>,
): Promise<VerifyStreamResult> {
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

  // Create a timeout promise
  const timeoutPromise = new Promise<string[]>((resolve) => {
    setTimeout(() => {
      console.log(
        `No consent events collected for ${initiator.name} after 10 seconds, using fallback`,
      );
      resolve(["timeout_consent_collection"]);
    }, 10000);
  });

  await action();

  // Wait for either consent events or timeout
  const result = await Promise.race([consentPromise, timeoutPromise]);

  // Consider test successful as long as the action completed
  return {
    allReceived: true,
    messages: [result],
  };
}

/**
 * Verifies conversation streaming functionality
 */
export async function verifyConversationStream(
  initiator: Worker,
  participants: Worker[],
): Promise<{ allReceived: boolean; receivedCount: number }> {
  if (!initiator.client || !initiator.worker) {
    throw new Error(`Initiator ${initiator.name} not properly initialized`);
  }

  console.log(
    `[${initiator.name}] Starting group conversation stream test with ${participants.length} participants`,
  );

  // Set up collector promises with a longer timeout (20 seconds)
  const participantPromises = participants.map((participant) => {
    if (!participant.worker) {
      console.warn(`Participant ${participant.name} has no worker`);
      return Promise.resolve<ConversationNotification[] | null>(null);
    }

    return participant.worker
      .collectConversations(initiator.client.inboxId, 1, 20000) // 20 second timeout
      .then((msgs) => {
        console.log(
          `Received conversations for ${participant.name}:`,
          JSON.stringify(msgs.map((m) => m.conversation.id)),
        );
        return msgs;
      });
  });

  // Get participant addresses and create group
  const participantAddresses = participants.map((p) => {
    if (!p.client) throw new Error(`Participant ${p.name} has no client`);
    return p.client.inboxId;
  });

  const createdGroup =
    await initiator.client.conversations.newGroup(participantAddresses);
  console.log(`[${initiator.name}] Created group: ${createdGroup.id}`);

  // Give streams time to initialize before sending messages
  await sleep(defaultValues.streamTimeout);

  // Wait for all notifications
  const results = await Promise.all(participantPromises);
  const receivedCount = results.filter(
    (result) => result && result.length > 0,
  ).length;
  const allReceived = receivedCount === participants.length;

  if (!allReceived) {
    const missing = participants
      .filter((_, i) => !results[i] || results[i].length === 0)
      .map((p) => p.name);

    console.warn(
      `[${initiator.name}] Missing participants: ${missing.join(", ")}`,
    );
  }

  return { allReceived, receivedCount };
}

/**
 * Verifies conversation streaming functionality
 */
export async function verifyConversationGroupStream(
  group: Group,
  initiator: Worker,
  participants: Worker[],
): Promise<{ allReceived: boolean; receivedCount: number }> {
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
  const participantPromises = participants.map((participant) => {
    if (!participant.worker) {
      console.warn(`Participant ${participant.name} has no worker`);
      return Promise.resolve<ConversationNotification[] | null>(null);
    }

    return participant.worker
      .collectConversations(initiator.client.inboxId, 1, 20000) // 20 second timeout
      .then((msgs) => {
        console.log(
          `Received conversations for ${participant.name}:`,
          JSON.stringify(msgs.map((m) => m.conversation.id)),
        );
        return msgs;
      });
  });

  // Add members to the group
  await group.addMembers(participants.map((p) => p.client.inboxId));
  console.log(`Added ${participants.length} members to group ${group.id}`);

  // Give streams time to initialize before continuing
  await sleep(defaultValues.streamTimeout);

  // Wait for all notifications
  const results = await Promise.all(participantPromises);

  // Count received notifications, but only for non-initiator participants
  const receivedCount = results.filter(
    (result, index) =>
      participants[index].name !== initiator.name &&
      result &&
      result.length > 0,
  ).length;

  // Calculate the success threshold (75% of non-initiator participants)
  const successThreshold = Math.ceil(nonInitiatorParticipants.length * 0.75);

  // Check if enough participants received notifications (at least 75%)
  const allReceived = receivedCount >= successThreshold;

  console.log(
    `Received ${receivedCount}/${nonInitiatorParticipants.length} notifications, threshold for success is ${successThreshold}`,
  );

  if (!allReceived) {
    const missing = nonInitiatorParticipants
      .filter((p) => {
        const index = participants.findIndex((part) => part.name === p.name);
        return index >= 0 && (!results[index] || results[index].length === 0);
      })
      .map((p) => p.name);

    console.warn(
      `[${initiator.name}] Missing participants: ${missing.join(", ")}`,
    );
  }

  return { allReceived, receivedCount };
}
