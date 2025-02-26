import {
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

  // Wait to ensure they are listening
  await new Promise((res) => setTimeout(res, 1000));

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
