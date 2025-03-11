import {
  type Conversation,
  type Group,
  type NestedPersonas,
  type Persona,
  type VerifyStreamResult,
} from "./types";
import type { MessageStreamWorker } from "./workers/main";

export async function getPersonasFromGroup(
  group: Conversation,
  personas: NestedPersonas,
): Promise<Persona[]> {
  await group.sync();
  const members = await group.members();
  const memberInboxIds = members.map((member) => member.inboxId);

  // Use the getPersonas method to retrieve all personas
  const allPersonas = personas.getPersonas();

  // Find personas whose client inboxId matches the group members' inboxIds
  const personasFromGroup = allPersonas.filter((persona) =>
    memberInboxIds.includes(persona.client?.inboxId || ""),
  );

  return personasFromGroup;
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
  await (group as Group).updateName(payload);
};

export async function verifyStreamAll(
  group: Conversation,
  participants: NestedPersonas,
  count = 1,
) {
  const allPersonas = await getPersonasFromGroup(group, participants);
  return verifyStream(group, allPersonas, "text", count);
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
 * @returns Promise resolving with results of the verification
 */
export async function verifyConversationStream(
  initiator: Persona,
  participants: Persona[],
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

  // Wait for all participant promises to resolve ()
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

/**
 * Verifies the order of messages received in a stream or pulled from a conversation
 *
 * @param receivedMessages - Array of received messages to check
 * @param expectedPrefix - The expected prefix for messages (e.g., 'gm-' or 'message-')
 * @param randomSuffix - The random suffix used to identify messages in this test run
 * @param expectedCount - The expected number of messages
 * @returns Object containing whether messages are in order and the expected messages
 */

// Helper function to calculate message reception and order percentages
export function calculateMessageStats(
  messagesByPersona: string[][],
  prefix: string,
  amount: number,
  suffix: string,
) {
  const verifyMessageOrder = (
    receivedMessages: string[],
    expectedPrefix: string = "gm-",
    expectedCount?: number,
  ): { inOrder: boolean; expectedMessages: string[] } => {
    // If no messages received, return early
    if (receivedMessages.length === 0) {
      return { inOrder: false, expectedMessages: [] };
    }

    // Use the provided suffix parameter directly
    const randomSuffix = suffix;

    // Determine the count of expected messages
    const count = expectedCount || receivedMessages.length;

    // Generate the expected messages in order
    const expectedMessages = Array.from(
      { length: count },
      (_, i) => `${expectedPrefix}${i + 1}-${randomSuffix}`,
    );

    // Check if received messages are in the expected order
    const inOrder =
      receivedMessages.length === expectedMessages.length &&
      receivedMessages.every((msg, index) => msg === expectedMessages[index]);

    return {
      inOrder,
      expectedMessages,
    };
  };
  const showDiscrepancies = (
    personasInOrder: number,
    personaCount: number,
    prefix: string,
    amount: number,
  ) => {
    // Log any discrepancies in message order
    if (personasInOrder < personaCount) {
      console.log("Message order discrepancies detected:");

      messagesByPersona.forEach((messages, index) => {
        const { inOrder, expectedMessages } = verifyMessageOrder(
          messages,
          prefix,
          amount,
        );

        if (!inOrder) {
          console.log(
            `Persona ${index + 1} received messages out of order or missing messages:`,
          );

          // Check for missing messages
          if (messages.length !== expectedMessages.length) {
            console.log(
              `  Expected ${expectedMessages.length} messages, received ${messages.length}`,
            );
          }

          // Find specific discrepancies
          const discrepancies = [];

          // Check for messages in wrong order or missing
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
            console.debug(`Discrepancies:`);
            discrepancies.forEach((d) => {
              console.debug(d);
            });
          }
        }
      });
    }
  };
  const showComparativeTable = (messagesByPersona: string[][]) => {
    console.log("Comparative Table:");
    messagesByPersona.forEach((messages, index) => {
      console.log(`Persona ${index + 1}: ${messages.join(", ")}`);
    });
  };
  // Check message reception
  let totalExpectedMessages = 0;
  let totalReceivedMessages = 0;

  // Check message order
  let personasInOrder = 0;
  const personaCount = messagesByPersona.length;

  for (const personaMessages of messagesByPersona) {
    totalExpectedMessages += amount;
    totalReceivedMessages += personaMessages.length;

    const { inOrder } = verifyMessageOrder(personaMessages, prefix, amount);

    if (inOrder) {
      personasInOrder++;
    }
  }

  const receptionPercentage =
    (totalReceivedMessages / totalExpectedMessages) * 100;
  const orderPercentage = (personasInOrder / personaCount) * 100;

  console.log("Expected messages pattern:", `${prefix}[1-${amount}]-${suffix}`);
  console.log(
    `Reception percentage: ${receptionPercentage.toFixed(2)}% (${totalReceivedMessages}/${totalExpectedMessages} messages)`,
  );
  console.log(
    `Order percentage: ${orderPercentage.toFixed(2)}% (${personasInOrder}/${personaCount} personas)`,
  );
  showDiscrepancies(personasInOrder, personaCount, prefix, amount);
  //showComparativeTable(messagesByPersona);
  return {
    receptionPercentage,
    orderPercentage,
    personasInOrder,
    personaCount,
    totalReceivedMessages,
    totalExpectedMessages,
  };
}
