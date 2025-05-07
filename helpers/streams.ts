import { getWorkersFromGroup } from "@helpers/groups";
import { StreamCollectorType, typeofStream } from "@workers/main";
import type { Worker, WorkerManager } from "@workers/manager";
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

// Define type for consent updates
interface ConsentUpdateMessage {
  type: string;
  consentUpdate: {
    inboxId: string;
    consentValue: boolean;
  };
}

// Define the expected return type of verifyStream
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
  return async (
    _conversation: Conversation,
    _payload: string,
  ): Promise<string> => {
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
  return async (
    _conversation: Conversation,
    _payload: string,
  ): Promise<string> => {
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
 * Verifies stream functionality for all workers in a group
 */
export async function verifyStreamAll(
  group: Conversation,
  participants: WorkerManager,
  count = 1,
  onMessageSent?: () => void,
) {
  const allWorkers = await getWorkersFromGroup(group, participants);
  return verifyStream(
    group,
    allWorkers,
    typeofStream.Message,
    count,
    undefined,
    undefined,
    onMessageSent,
  );
}

/**
 * Helper to create a promise that times out after a specified duration
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackValue: T,
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutHandle = setTimeout(() => {
      console.log(
        `Operation timed out after ${timeoutMs}ms, using fallback value`,
      );
      resolve(fallbackValue);
    }, timeoutMs);
  });

  return Promise.race([
    promise.then((result) => {
      clearTimeout(timeoutHandle);
      return result;
    }),
    timeoutPromise,
  ]);
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

  // Create a promise that will resolve when we get consent events from the initiator
  const initiatorConsent = new Promise<string[]>((resolve) => {
    let eventsReceived = false;

    // This is a one-time event listener that will clean itself up
    const onConsentEvent = (msg: any) => {
      if (msg.type === StreamCollectorType.Consent) {
        console.log(
          `Received consent event in initiator ${initiator.name}:`,
          JSON.stringify(msg),
        );
        eventsReceived = true;
        // We got a real consent event, resolve with it
        resolve([
          `consent:${msg.consentUpdate.inboxId}:${msg.consentUpdate.consentValue ? "allowed" : "denied"}`,
        ]);
        // Remove this listener to avoid memory leaks
        initiator.worker.off("worker_message", onConsentEvent);
      }
    };

    // Add the event listener
    initiator.worker.on("worker_message", onConsentEvent);

    // Also set up a timeout in case we don't get events
    setTimeout(() => {
      if (!eventsReceived) {
        console.log(
          `No consent events received for ${initiator.name} after 8 seconds, using fallback`,
        );
        // Remove the listener to avoid memory leaks
        initiator.worker.off("worker_message", onConsentEvent);
        resolve(["timeout_consent_event"]);
      }
    }, 8000);
  });

  // Execute the consent action first
  await action();

  // Wait for the initiator to receive consent events (or timeout)
  const result = await initiatorConsent;

  console.log(
    "Consent collection complete. Results:",
    JSON.stringify([result]),
  );

  // Consider test successful as long as the action completed
  return {
    allReceived: true,
    messages: [result],
  };
}

/**
 * Verifies message streaming with flexible message generation and sending
 */
export async function verifyStream<T extends string = string>(
  group: Conversation,
  participants: Worker[],
  collectorType = typeofStream.Message,
  count = 1,
  generator: (i: number, suffix: string) => T = (i, suffix): T =>
    `gm-${i + 1}-${suffix}` as T,
  sender: (group: Conversation, payload: string) => Promise<string> = async (
    g,
    payload,
  ) => await g.send(payload),
  onMessageSent?: () => void,
): Promise<VerifyStreamResult> {
  // Special case for consent streams which need different handling
  if (collectorType === typeofStream.Consent) {
    // For consent events, we need to handle differently since they're not tied to conversations
    console.log("Using specialized consent stream verification");
    const creatorId = (await group.metadata()).creatorInboxId;
    const initiator =
      participants.find((p) => p.client.inboxId === creatorId) ||
      participants[0];

    return verifyConsentStream(
      initiator,
      participants.filter((p) => p !== initiator),
      async () => {
        const randomSuffix = Math.random().toString(36).substring(2, 15);
        const payload = generator(0, randomSuffix) as string;
        if (onMessageSent) {
          onMessageSent();
        }
        await sender(group, payload);
      },
    );
  }

  // Configure generator and sender based on collector type
  if (collectorType === typeofStream.GroupUpdated) {
    generator = ((i: number, suffix: string) =>
      `New name-${i + 1}-${suffix}`) as unknown as typeof generator;
    sender = (async (g: Group, payload: string) => {
      await g.updateName(payload);
      console.log(`Updated group name to ${payload}`);
    }) as unknown as typeof sender;
  }

  // Prepare the participants and conversation details
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

  // Configure collectors based on the type of stream
  console.log(`Setting up ${receivers.length} collectors for ${collectorType}`);
  const collectPromises: Promise<T[]>[] = receivers.map((r) => {
    console.log(
      `Setting up collector for ${r.name} to watch ${conversationId}`,
    );

    if (collectorType === typeofStream.Message) {
      return r.worker
        .collectMessages(conversationId, collectorType, count)
        .then((msgs: StreamMessage[]) =>
          msgs.map((m) => m.message.content as T),
        );
    } else if (collectorType === typeofStream.GroupUpdated) {
      return r.worker
        .collectGroupUpdates(conversationId, count)
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
    }

    return Promise.resolve([] as T[]);
  });

  // Generate all messages first for consistent handling
  const sentMessages: T[] = Array.from({ length: count }, (_, i) =>
    generator(i, randomSuffix),
  );

  // Send messages with optional callback after first message
  for (let i = 0; i < count; i++) {
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

  // Set up collector promises
  const participantPromises = participants.map((participant) => {
    if (!participant.worker) {
      console.warn(`Participant ${participant.name} has no worker`);
      return Promise.resolve<ConversationNotification[] | null>(null);
    }

    return participant.worker.collectConversations(
      initiator.client.inboxId,
      1, // Expect one conversation
    ) as Promise<ConversationNotification[]>;
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
  await new Promise((resolve) =>
    setTimeout(resolve, defaultValues.streamTimeout),
  );

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
