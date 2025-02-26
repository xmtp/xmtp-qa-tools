import dotenv from "dotenv";
import { afterAll, beforeAll, describe, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  type Conversation,
  type Persona,
} from "../helpers/types";
import { getWorkers } from "../helpers/workers/factory";

dotenv.config();

const env = "dev";
const testName = "TS_GroupConversationStreams_" + env;

describe(testName, () => {
  let personas: Record<string, Persona>;

  beforeAll(async () => {
    const logger = await createLogger(testName);
    overrideConsole(logger);
    personas = await getWorkers(
      ["bob", "joe", "elon", "fabri", "alice"],
      "dev",
      testName,
      "conversation",
    );
  });

  afterAll(async () => {
    await flushLogger(testName);
    await Promise.all(
      Object.values(personas).map(async (persona) => {
        await persona.worker?.terminate();
      }),
    );
  });

  it("detects new group conversation creation with three participants", async () => {
    const initiator = personas.alice;
    const participants = [personas.bob, personas.joe];

    await verifyGroupConversationStream(
      initiator,
      participants,
      (initiator, participants) => {
        if (!initiator.client) {
          throw new Error("Initiator has no client");
        }

        const participantAddresses = participants.map((p) => {
          if (!p.client) {
            throw new Error(`Participant ${p.name} has no client`);
          }
          return p.client.accountAddress;
        });

        return initiator.client.conversations.newGroup(participantAddresses);
      },
    );
  });

  it("detects new group conversation with all available personas", async () => {
    const initiator = personas.fabri;
    const participants = [
      personas.alice,
      personas.bob,
      personas.joe,
      personas.elon,
    ];

    await verifyGroupConversationStream(
      initiator,
      participants,
      (initiator, participants) => {
        if (!initiator.client) {
          throw new Error("Initiator has no client");
        }

        const participantAddresses = participants.map((p) => {
          if (!p.client) {
            throw new Error(`Participant ${p.name} has no client`);
          }
          return p.client.accountAddress;
        });

        return initiator.client.conversations.newGroup(participantAddresses);
      },
    );
  });

  it("detects new group conversation with custom name", async () => {
    const initiator = personas.elon;
    const participants = [personas.alice, personas.bob];
    const groupName = "Test Group Chat";

    await verifyGroupConversationStream(
      initiator,
      participants,
      (initiator, participants) => {
        if (!initiator.client) {
          throw new Error("Initiator has no client");
        }

        const participantAddresses = participants.map((p) => {
          if (!p.client) {
            throw new Error(`Participant ${p.name} has no client`);
          }
          return p.client.accountAddress;
        });

        // Use optional parameter for group name
        return initiator.client.conversations.newGroup(participantAddresses, {
          groupName: groupName,
        });
      },
    );
  });
});

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
    participants: Persona[],
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
  const createdGroup = await groupCreator(initiator, participants);

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
