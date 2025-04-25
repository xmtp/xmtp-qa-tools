import { getWorkersFromGroup } from "@helpers/groups";
import type { MessageStreamWorker } from "@workers/main";
import type { Worker, WorkerManager } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";

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
) {
  const allWorkers = await getWorkersFromGroup(group, participants);
  return verifyStream(group, allWorkers, "text", count);
}

/**
 * Verifies message streaming with flexible message generation and sending
 */
export async function verifyStream<T extends string = string>(
  group: Conversation,
  participants: Worker[],
  collectorType = "text",
  count = 1,
  generator: (i: number, suffix: string) => T = (i, suffix): T =>
    `gm-${i + 1}-${suffix}` as T,
  sender: (group: Conversation, payload: string) => Promise<string> = async (
    g,
    payload,
  ) => await g.send(payload),
): Promise<VerifyStreamResult> {
  // Use name updater for group_updated collector type
  if (collectorType === "group_updated") {
    generator = ((i: number, suffix: string) =>
      `New name-${i + 1}-${suffix}`) as any;
    sender = (async (g: Group, payload: string) => {
      await g.updateName(payload);
    }) as any;
  }

  // Exclude group creator from receivers
  const creatorId = (await group.metadata()).creatorInboxId;
  const receivers = participants.filter((p) => p.client?.inboxId !== creatorId);
  const conversationId = group.id;
  const randomSuffix = Math.random().toString(36).substring(2, 15);

  console.log(
    `Starting stream test with ${receivers.length} receivers on group ${conversationId}`,
  );

  // Pre-sync: Ensure all receivers have synced the conversation before collecting messages
  await Promise.all(
    receivers.map(async (r) => {
      try {
        await r.client.conversations.sync();
        const convo =
          await r.client.conversations.getConversationById(conversationId);
      } catch (err) {
        console.error(`Error syncing for ${r.name}:`, err);
      }
    }),
  );

  // Give streams time to initialize before sending messages
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Start collectors
  const collectPromises = receivers.map((r) =>
    r.worker
      ?.collectMessages(conversationId, collectorType, count)
      .then((msgs: MessageStreamWorker[]) =>
        msgs.map((m) => m.message.content as T),
      ),
  );

  // Generate all the messages first so we have them for recovery later
  const sentMessages: T[] = [];
  for (let i = 0; i < count; i++) {
    sentMessages.push(generator(i, randomSuffix));
  }

  // Send the messages with delays between them
  for (let i = 0; i < count; i++) {
    await sender(group, sentMessages[i]);
    // Add a small delay between messages to avoid rate limiting
    if (i < count - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  console.log(`Sent ${count} messages`);

  // Wait for collectors
  const streamCollectedMessages = await Promise.all(collectPromises);

  // Check if all messages were received
  const streamAllReceived = streamCollectedMessages.every(
    (msgs) => msgs?.length === count,
  );

  console.log(
    streamAllReceived
      ? "All participants received the expected number of messages"
      : "Not all participants received the expected number of messages",
  );

  return {
    allReceived: streamAllReceived,
    messages: streamCollectedMessages.map((m) => m ?? []),
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
      return Promise.resolve(null);
    }

    return participant.worker.collectConversations(
      initiator.client.inboxId,
      1, // Expect one conversation
    );
  });

  // Get participant addresses and create group
  const participantAddresses = participants.map((p) => {
    if (!p.client) throw new Error(`Participant ${p.name} has no client`);
    return p.client.inboxId;
  });

  const createdGroup =
    await initiator.client.conversations.newGroup(participantAddresses);
  console.log(`[${initiator.name}] Created group: ${createdGroup.id}`);

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
