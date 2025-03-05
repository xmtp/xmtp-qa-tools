import {
  defaultValues,
  type Client,
  type Conversation,
  type Persona,
  type VerifyStreamResult,
} from "./types";
import type { MessageStreamWorker } from "./workers/main";

export async function getPersonasFromGroup(
  group: Conversation,
  personas: Record<string, Persona>,
): Promise<Persona[]> {
  await group.sync();
  const members = await group.members();
  const memberInboxIds = members.map((member) => {
    return {
      inboxId: member.inboxId,
    };
  });
  const personasFromGroup = memberInboxIds.map((m) => {
    return Object.keys(personas).find(
      (name) => personas[name].client?.inboxId === m.inboxId,
    );
  });
  // Convert persona names to actual Persona objects and filter out undefined values
  const personaObjects = personasFromGroup
    .filter((name): name is string => name !== undefined)
    .map((name) => personas[name]);
  return personaObjects;
}

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

const nameUpdateGenerator = (i: number, suffix: string) => {
  return `New name-${i + 1}-${suffix}`;
};

const nameUpdater = async (group: Conversation, payload: string) => {
  await group.updateName(payload);
};

export async function verifyStreamAll(
  group: Conversation,
  participants: Record<string, Persona>,
) {
  const allPersonas = await getPersonasFromGroup(group, participants);
  return verifyStream(group, allPersonas);
}
export async function verifyStream<T extends string = string>(
  group: Conversation,
  participants: Persona[],
  collectorType = "text",
  count = 1,
  generator: (index: number, suffix: string) => T = (
    i: number,
    suffix: string,
  ): T => `gm-${i + 1}-${suffix}` as T,
  sender: (group: Conversation, payload: T) => Promise<void> = async (
    group: Conversation,
    payload: T,
  ) => {
    await group.send(payload);
  },
): Promise<VerifyStreamResult> {
  if (collectorType === "group_updated") {
    generator = nameUpdateGenerator as (index: number, suffix: string) => T;
    sender = nameUpdater as (group: Conversation, payload: T) => Promise<void>;
  }
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
    const payload = generator(i, randomSuffix);
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
export async function verifyConversationStream(
  initiator: Persona,
  participants: Persona[],
  timeoutMs = defaultValues.timeout,
): Promise<{ allReceived: boolean; receivedCount: number }> {
  const groupCreator = async (
    initiator: Persona,
    participantAddresses: string[],
  ) => {
    if (!initiator.client) {
      throw new Error("Initiator has no client");
    }
    return initiator.client.conversations.newGroup(participantAddresses);
  };

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
