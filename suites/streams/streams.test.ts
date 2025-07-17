import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkerNames, getWorkers } from "@workers/manager";
import { type Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "streams-stress-test";

describe(testName, async () => {
  // Create 1 agent worker and 5 client workers
  const agentWorkers = await getWorkers(1, { useVersions: false });
  const clientWorkers = await getWorkers(5, { useVersions: false });

  // Combine all workers for management
  const allWorkers = await getWorkers(6, { useVersions: false });

  setupTestLifecycle({ testName });

  it("should handle concurrent message delivery with agent response", async () => {
    const agent = agentWorkers.getCreator();
    const clients = clientWorkers.getAll();

    console.log(
      `🚀 Testing ${clients.length} clients against agent ${agent.name}`,
    );

    // Start message streams for all clients
    clients.forEach((client) => {
      client.worker.startStream(typeofStream.Message);
    });

    // Create DMs from each client to the agent
    const conversations = await Promise.all(
      clients.map(async (client) => {
        const dm = await client.client.conversations.newDm(
          agent.client.inboxId,
        );
        console.log(`💬 ${client.name}: DM created with agent`);
        return { client, conversation: dm };
      }),
    );

    // Send messages from all clients concurrently
    console.log(`📤 Sending messages from all clients...`);
    const messagePromises = conversations.map(
      async ({ client, conversation }, index) => {
        const message = `test-${client.name}-${Date.now()}-${index}`;
        await conversation.send(message);
        console.log(`📩 ${client.name}: Message sent`);
        return { client, conversation, message };
      },
    );

    const sentMessages = await Promise.all(messagePromises);
    console.log(`✅ All ${sentMessages.length} messages sent`);

    // Verify message delivery for each conversation
    const verificationPromises = sentMessages.map(
      async ({ client, conversation }) => {
        const result = await verifyMessageStream(
          conversation as Conversation,
          [agent], // Agent should receive the message
          1, // One message per conversation
          `test-${client.name}-{i}-{randomSuffix}`,
        );

        console.log(
          `📊 ${client.name} -> Agent: Reception=${result.receptionPercentage}%, Timing=${result.averageEventTiming}ms`,
        );
        return { client, result };
      },
    );

    const verificationResults = await Promise.all(verificationPromises);

    // Calculate summary statistics
    const successfulDeliveries = verificationResults.filter(
      (r) => r.result.allReceived,
    );
    const successRate =
      (successfulDeliveries.length / verificationResults.length) * 100;

    const avgTiming =
      verificationResults.length > 0
        ? verificationResults.reduce(
            (sum, r) => sum + r.result.averageEventTiming,
            0,
          ) / verificationResults.length
        : 0;

    const avgReception =
      verificationResults.length > 0
        ? verificationResults.reduce(
            (sum, r) => sum + r.result.receptionPercentage,
            0,
          ) / verificationResults.length
        : 0;

    // Print summary
    console.log(`\n📊 Summary:`);
    console.log(
      `   Successful Deliveries: ${successfulDeliveries.length}/${verificationResults.length}`,
    );
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`   Average Reception Rate: ${avgReception.toFixed(1)}%`);
    console.log(`   Average Response Time: ${Math.round(avgTiming)}ms`);
    console.log(`   Total Messages: ${verificationResults.length}`);

    // Assertions
    expect(successRate).toBeGreaterThanOrEqual(80); // At least 80% success rate
    expect(avgReception).toBeGreaterThanOrEqual(80); // At least 80% reception rate
    expect(avgTiming).toBeLessThan(5000); // Average response time under 5 seconds

    // Individual client assertions - only for successful deliveries
    verificationResults
      .filter(({ result }) => result.allReceived)
      .forEach(({ client, result }) => {
        expect(result.receptionPercentage).toBeGreaterThan(80);
        expect(result.averageEventTiming).toBeLessThan(10000);
      });
  }, 30000); // 30 second timeout
});
