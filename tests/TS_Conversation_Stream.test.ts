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
const testName = "TS_ConversationStreams_" + env;

describe(testName, () => {
  let personas: Record<string, Persona>;

  beforeAll(async () => {
    const logger = await createLogger(testName);
    overrideConsole(logger);
    personas = await getWorkers(
      ["bob", "random", "elon", "fabri", "alice"],
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

  it("detects new conversation creation with proper ID", async () => {
    /* Use the verifyConversationStream function to verify that the conversation stream is working */
    await verifyConversationStream(
      personas.alice,
      [personas.random],
      (initiator, recipient) => {
        if (!initiator.client || !recipient.client) {
          throw new Error("Initiator or recipient has no client");
        }
        return initiator.client.conversations.newDm(
          recipient.client.accountAddress,
        );
      },
    );
  });
});

/**
 * Verifies that conversation stream events are properly received
 * by the recipients when a new conversation is created.
 *
 * @param initiator - The persona creating the conversation
 * @param recipients - Array of personas that should receive the conversation event
 * @param convoCreator - Function to create a new conversation
 * @param timeoutMs - How long to wait for the conversation event
 * @returns Promise resolving with results of the verification
 */
export async function verifyConversationStream(
  initiator: Persona,
  recipients: Persona[],
  convoCreator: (
    initiator: Persona,
    recipient: Persona,
  ) => Promise<Conversation>,
  timeoutMs = defaultValues.timeout,
): Promise<{ allReceived: boolean; receivedCount: number }> {
  console.log(
    `[${initiator.name}] Starting conversation stream verification test`,
  );

  if (!initiator.worker) {
    throw new Error(`Initiator ${initiator.name} has no worker`);
  }

  // Set up promises to collect conversations for all recipients
  const recipientPromises = recipients.map((recipient) => {
    if (!recipient.worker) {
      console.warn(`Recipient ${recipient.name} has no worker`);
      return Promise.resolve(null);
    }

    if (!initiator.client) {
      throw new Error(`Initiator ${initiator.name} has no client`);
    }

    // Use the worker's collectConversations method to wait for conversation events
    return recipient.worker.collectConversations(
      initiator.client.inboxId,
      1, // We expect just one conversation
      timeoutMs, // Use the provided timeout
    );
  });

  // Create a new conversation with the first recipient
  const firstRecipient = recipients[0];
  console.log(
    `[${initiator.name}] Creating new conversation with ${firstRecipient.name}`,
  );
  const createdConvo = await convoCreator(initiator, firstRecipient);

  const createdConvoId = createdConvo.id;
  console.log(
    `[${initiator.name}] Created conversation with ID: ${createdConvoId}`,
  );

  // Wait for all recipient promises to resolve (or timeout)
  const results = await Promise.all(recipientPromises);
  console.log(`[${initiator.name}] Received ${results.length} conversations`);
  // Count how many recipients received the conversation
  const receivedCount = results.filter(
    (result) => result && result.length > 0,
  ).length;
  const allReceived = receivedCount === recipients.length;

  if (!allReceived) {
    const missing = recipients
      .filter((_, index) => !results[index] || results[index].length === 0)
      .map((r) => r.name);
    console.warn(
      `[${initiator.name}] Some recipients did not receive conversation: ${missing.join(", ")}`,
    );
  }

  return {
    allReceived,
    receivedCount,
  };
}
