import { getWorkersFromGroup } from "@helpers/groups";
import type { MessageStreamWorker } from "@workers/main";
import type { Worker, WorkerManager } from "@workers/manager";
import { type Conversation, type Group } from "@xmtp/node-sdk";

// Define the expected return type of verifyStream
export type VerifyStreamResult = {
  allReceived: boolean;
  messages: string[][];
};

const nameUpdateGenerator = (i: number, suffix: string) => {
  return `New name-${i + 1}-${suffix}`;
};

const nameUpdater = async (group: Conversation, payload: string) => {
  await (group as Group).updateName(payload);
};

export async function verifyStreamAll(
  group: Conversation,
  participants: WorkerManager,
  count = 1,
) {
  const allWorkers = await getWorkersFromGroup(group, participants);
  return verifyStream(group, allWorkers, "text", count);
}
export async function verifyStream<T extends string = string>(
  group: Conversation,
  participants: Worker[],
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
    //console.log(`Sending message #${i + 1}:`, payload);
    await sender(group, payload);
  }
  console.log(`Sent ${count} messages`);

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

export async function verifyConversationStream(
  initiator: Worker,
  participants: Worker[],
): Promise<{ allReceived: boolean; receivedCount: number }> {
  const groupCreator = async (
    initiator: Worker,
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
    return p.client.inboxId;
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
