import { type Conversation, type Persona, type WorkerMessage } from "./types";

export async function verifyStream<T>(
  group: Conversation,
  participants: Persona[],
  messageGenerator: (index: number, suffix: string) => Promise<T>,
  sender: (group: Conversation, payload: T) => Promise<void>,
  collectorType: string = "text",
  count: number = 1,
): Promise<{ allReceived: boolean; messages: T[][] }> {
  // Exclude the group creator.
  const creatorInboxId = (await group.metadata()).creatorInboxId;
  const receivers = participants.filter(
    (p) => p.client?.inboxId !== creatorInboxId,
  );

  // Setup collectors for each receiver.
  const streamPromises = receivers.map((r) =>
    r.worker
      ?.collectMessages(collectorType, count, count * 2000)
      .then((msgs: WorkerMessage[]) => msgs.map((m) => m.message.content as T)),
  );

  // Wait briefly to ensure all streams are listening.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Create a fixed random suffix for message consistency.
  const randomSuffix = Math.random().toString(36).substring(2, 15);

  // Generate and send messages.
  for (let i = 0; i < count; i++) {
    const payload = await messageGenerator(i, randomSuffix);
    console.log(`Sending payload:`, payload);
    await sender(group, payload);
  }

  // Wait for all collectors to finish.
  const collectedMessages = await Promise.all(streamPromises);
  const allReceived = collectedMessages.every(
    (msgs) => msgs && msgs.length === count,
  );

  if (!allReceived) {
    console.error(
      "Not all participants received the expected number of messages.",
    );
  } else {
    console.log("All participants received the expected number of messages.");
  }

  return {
    allReceived,
    messages: collectedMessages.map((m) => m || []),
  };
}

// export async function verifyMeta(
//   group: Conversation,
//   participants: Persona[],
//   count: number = 1,
// ): Promise<{ allReceived: boolean; messages: string[][] }> {
//   // Exclude the group creator.
//   const creatorInboxId = (await group.metadata()).creatorInboxId;
//   const receivers = participants.filter(
//     (p) => p.client?.inboxId !== creatorInboxId,
//   );

//   // For each receiver, call the persistent collector.
//   // Each collector returns an array of WorkerMessages.
//   // We then map each WorkerMessage to its content.
//   const streamPromises = receivers.map((r) =>
//     r.worker
//       ?.collectMessages("group_updated", count, count * 2000) // 2 seconds per message
//       .then((msgs: WorkerMessage[]) =>
//         msgs.map((m) => m.message.content as string),
//       ),
//   );

//   // Wait briefly to ensure all streams are listening.
//   await new Promise((resolve) => setTimeout(resolve, 1000));

//   // Prepare messages with a fixed random suffix so that all messages share the same suffix.
//   const randomSuffix = Math.random().toString(36).substring(2, 15);

//   for (let i = 0; i < count; i++) {
//     const msg = `New name-${i + 1}-${randomSuffix}`;
//     console.log(`Updating group name: ${msg}`);
//     await group.updateName(msg);
//   }

//   // Now wait for all listeners to collect their messages.
//   const collectedMessages = await Promise.all(streamPromises);
//   // Verify that all participants received the messages
//   const allReceived = collectedMessages.every(
//     (msgs) => msgs && msgs.length === count,
//   );
//   if (!allReceived) {
//     console.error(
//       "Not all participants received the expected number of messages.",
//     );
//   }

//   return {
//     allReceived,
//     messages: collectedMessages.map((m) => m || []),
//   };
// }
