import { getWorkersFromGroup } from "@helpers/groups";
import { typeofStream } from "@workers/main";
import type { Worker, WorkerManager } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";
import { defaultValues } from "./tests";

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

// Define the expected return type of verifyStream
export type VerifyStreamResult = {
  allReceived: boolean;
  messages: string[][];
};

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
  // Use name updater for group_updated collector type
  if (collectorType === typeofStream.GroupUpdated) {
    generator = ((i: number, suffix: string) =>
      `New name-${i + 1}-${suffix}`) as unknown as typeof generator;
    sender = (async (g: Group, payload: string) => {
      await g.updateName(payload);
    }) as unknown as typeof sender;
  } else if (collectorType === typeofStream.Conversation) {
    generator = ((i: number, suffix: string) =>
      `New name-${i + 1}-${suffix}`) as unknown as typeof generator;
    sender = (async (client: Client, payload: string) => {
      await client.conversations.newGroup(payload);
    }) as unknown as typeof sender;
  } else if (collectorType === typeofStream.Consent) {
    generator = ((i: number, suffix: string) =>
      `New name-${i + 1}-${suffix}`) as unknown as typeof generator;
    sender = (async (g: Group, payload: number) => {
      await (g.updateConsentState(payload as ConsentState) as Promise<void>);
    }) as unknown as typeof sender;
  }

  // Exclude group creator from receivers
  const creatorId = (await group.metadata()).creatorInboxId;
  const receivers = participants.filter((p) => p.client?.inboxId !== creatorId);
  const conversationId = group.id;
  const randomSuffix = Math.random().toString(36).substring(2, 15);

  await Promise.all(
    receivers.map(async (r) => {
      try {
        await r.client.conversations.sync();
      } catch (err) {
        console.error(`Error syncing for ${r.name}:`, err);
      }
    }),
  );

  // Give streams time to initialize before sending messages
  await new Promise((resolve) =>
    setTimeout(resolve, defaultValues.streamTimeout),
  );

  // Start collectors
  let collectPromises: Promise<T[]>[] = [];
  if (collectorType === typeofStream.Message) {
    collectPromises = receivers.map((r) => {
      if (!r.worker) {
        return Promise.resolve([]);
      }
      return r.worker
        .collectMessages(conversationId, collectorType, count)
        .then((msgs: StreamMessage[]) => {
          return msgs.map((m) => m.message.content as T);
        });
    });
  } else if (collectorType === typeofStream.GroupUpdated) {
    collectPromises = receivers.map((r) => {
      if (!r.worker) {
        return Promise.resolve([]);
      }
      return r.worker
        .collectGroupUpdates(conversationId, count)
        .then((msgs: GroupUpdateMessage[]) => {
          return msgs.map((m) => m.group.name as T);
        });
    });
  } else if (collectorType === typeofStream.Conversation) {
    collectPromises = receivers.map((r) => {
      if (!r.worker) {
        return Promise.resolve([]);
      }
      return r.worker
        .collectConversations(conversationId, count)
        .then((msgs: ConversationNotification[]) => {
          return msgs.map((m) => m.conversation.id as T);
        });
    });
  } else if (collectorType === typeofStream.Consent) {
    collectPromises = receivers.map((r) => {
      if (!r.worker) {
        return Promise.resolve([]);
      }
      return r.worker
        .collectConsents(conversationId, count)
        .then((msgs: ConsentNotification[]) => {
          return msgs.map((m) => m.consent.id as T);
        });
    });
  }

  // Generate all the messages first so we have them for recovery later
  const sentMessages: T[] = [];
  for (let i = 0; i < count; i++) {
    sentMessages.push(generator(i, randomSuffix));
  }

  // Send the messages with delays between them
  for (let i = 0; i < count; i++) {
    await sender(group, sentMessages[i]);

    // Call the onMessageSent callback if provided - right after first message is sent
    if (i === 0 && onMessageSent) {
      onMessageSent();
    }
  }

  // Wait for collectors
  const streamCollectedMessages = await Promise.all(collectPromises);

  // Check if all messages were received
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
