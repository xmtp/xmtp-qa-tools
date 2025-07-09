import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "rate-limited";
describe(testName, async () => {
  setupTestLifecycle({ testName });

  // Create 10 workers for parallel message sending
  const workers = await getWorkers(10);

  let targetInboxId: string = "0x194c31cae1418d5256e8c58e0d08aee1046c6ed0";

  it("should send 100 messages from 10 workers in parallel to test rate limiting", async () => {
    // Create a conversation with the target inbox
    const conversation = (await workers
      .getCreator()
      .client.conversations.newDmWithIdentifier({
        identifier: targetInboxId,
        identifierKind: IdentifierKind.Ethereum,
      })) as Conversation;

    // Send 100 messages in parallel from 10 workers (10 messages per worker)
    const result = await verifyMessageStream(
      conversation,
      workers.getAll(),
      10, // 10 messages per worker = 100 total messages
      "rate-test-{i}-{randomSuffix}",
    );

    // Verify that messages were sent and received
    expect(result.allReceived).toBe(true);
    expect(result.receptionPercentage).toBeGreaterThan(90); // Allow some tolerance for rate limiting
    console.log(
      `Rate limiting test completed: ${result.receptionPercentage}% messages received`,
    );
  });
});
