import {
  defaultValues,
  type Conversation,
  type Persona,
  type VerifyStreamResult,
} from "./types";
import type { MessageStreamWorker } from "./workers/main";

/**
 * Simplified `verifyStream` that sends messages to a conversation,
 * and ensures each participant collects exactly `count` messages.
 *
 * @param group Conversation (e.g. a group conversation)
 * @param participants Array of Persona objects
 * @param messageGenerator A function that produces the content (including a suffix)
 * @param sender Function to send messages to the conversation
 * @param collectorType The contentType ID to match in collecting
 * @param count Number of messages to send
 */
export async function verifyStream<T extends string>(
  group: Conversation,
  participants: Persona[],
  messageGenerator: (index: number, suffix: string) => Promise<T>,
  sender: (group: Conversation, payload: T) => Promise<void>,
  collectorType = "text",
  count = 1,
): Promise<VerifyStreamResult> {
  // Exclude the group creator from receiving
  const creatorInboxId = (await group.metadata()).creatorInboxId;
  const receivers = participants.filter(
    (p) => p.client?.inboxId !== creatorInboxId,
  );

  // Conversation ID (topic or peerAddress)
  // Modify as needed depending on how you store the ID
  const conversationId = group.id;

  // Unique random suffix to avoid counting old messages
  const randomSuffix = Math.random().toString(36).substring(2, 15);

  // Start collectors
  const collectPromises = receivers.map((r) =>
    r.worker
      ?.collectMessages(conversationId, collectorType, count)
      .then((msgs: MessageStreamWorker[]) =>
        msgs.map((m) => m.message.content as T),
      ),
  );
  // Send the messages
  for (let i = 0; i < count; i++) {
    const payload = await messageGenerator(i, randomSuffix);
    console.log(`Sending message #${i + 1}:`, payload);
    await sender(group, payload);
  }

  // Wait for collectors
  const collectedMessages = await Promise.all(collectPromises);
  const allReceived = collectedMessages.every((msgs) => msgs?.length === count);
  if (!allReceived) {
    console.error(
      "Not all participants received the expected number of messages.",
    );
  } else {
    console.log("All participants received the expected number of messages.");
  }

  return {
    allReceived,
    messages: collectedMessages.map((m) => m ?? []),
  };
}

/**
 * Verifies that group conversation stream events are properly received
 * by all participants when a new group is created.
 *
 * @param initiator - The persona creating the group conversation
 * @param participants - Array of personas that should be added to the group and receive the event
 * @param groupCreator - Function to create a new group conversation
 * @param timeoutMs - How long to wait for the conversation event
 * @returns Promise resolving with results of the verification
 */
export async function verifyGroupConversationStream(
  initiator: Persona,
  participants: Persona[],
  groupCreator: (
    initiator: Persona,
    participantAddresses: string[],
  ) => Promise<Conversation>,
  timeoutMs = defaultValues.timeout,
): Promise<{ allReceived: boolean; receivedCount: number }> {
  console.log(
    `[${initiator.name}] Starting group conversation stream verification test with ${participants.length} participants`,
  );

  if (!initiator.worker) {
    throw new Error(`Initiator ${initiator.name} has no worker`);
  }

  // Set up promises to collect conversations for all participants
  const participantPromises = participants.map((participant) => {
    if (!participant.worker) {
      console.warn(`Participant ${participant.name} has no worker`);
      return Promise.resolve(null);
    }

    if (!initiator.client) {
      throw new Error(`Initiator ${initiator.name} has no client`);
    }

    // Use the worker's collectConversations method to wait for conversation events
    return participant.worker.collectConversations(
      initiator.client.inboxId,
      1, // We expect just one conversation
      timeoutMs, // Use the provided timeout
    );
  });

  // Create a new group conversation
  console.log(
    `[${initiator.name}] Creating new group conversation with ${participants.length} participants`,
  );
  const participantAddresses = participants.map((p) => {
    if (!p.client) {
      throw new Error(`Participant ${p.name} has no client`);
    }
    return p.client.accountAddress;
  });

  const createdGroup = await groupCreator(initiator, participantAddresses);

  const createdGroupId = createdGroup.id;
  console.log(
    `[${initiator.name}] Created group conversation with ID: ${createdGroupId}`,
  );

  // Wait for all participant promises to resolve (or timeout)
  const results = await Promise.all(participantPromises);
  console.log(
    `[${initiator.name}] Received ${results.length} group conversation notifications`,
  );

  // Count how many participants received the conversation
  const receivedCount = results.filter(
    (result) => result && result.length > 0,
  ).length;
  const allReceived = receivedCount === participants.length;

  if (!allReceived) {
    const missing = participants
      .filter((_, index) => !results[index] || results[index].length === 0)
      .map((p) => p.name);
    console.warn(
      `[${initiator.name}] Some participants did not receive group conversation: ${missing.join(", ")}`,
    );
  }

  return {
    allReceived,
    receivedCount,
  };
}
