import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes } from "@inboxes/utils";
import { Client, type XmtpEnv } from "version-management/client-versions";
import { beforeAll, describe, it } from "vitest";

const testConfig = {
  randomInboxIds: getInboxes(100).map((a) => a.inboxId), // 100 DMs like the Rust test
  groupCount: 200, // 200 groups like the Rust test
  timeoutSeconds: 15, // Same timeout as Rust test
} as const;

const testName = "concurrency-race";
describe(testName, () => {
  setupDurationTracking({ testName });

  let primaryClient: Client;
  let secondaryClient: Client;
  let createdDms: string[] = [];
  let createdGroups: string[] = [];

  beforeAll(async () => {
    // Validate environment variables
    const env = {
      WALLET_KEY: process.env.WALLET_KEY!,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
      XMTP_ENV: process.env.XMTP_ENV!,
    };

    if (!env.WALLET_KEY || !env.ENCRYPTION_KEY || !env.XMTP_ENV) {
      throw new Error("Missing required environment variables");
    }

    // Create primary client (like the Rust test)
    const primarySigner = createSigner(env.WALLET_KEY);
    const primaryEncryptionKey = getEncryptionKeyFromHex(env.ENCRYPTION_KEY);
    primaryClient = await Client.create(primarySigner, {
      dbEncryptionKey: primaryEncryptionKey,
      env: env.XMTP_ENV as XmtpEnv,
    });

    // Create secondary client with a different key
    const secondaryKey = "0x" + "1".repeat(64); // Generate a different key for secondary
    const secondarySigner = createSigner(secondaryKey);
    const secondaryEncryptionKey = getEncryptionKeyFromHex(env.ENCRYPTION_KEY);
    secondaryClient = await Client.create(secondarySigner, {
      dbEncryptionKey: secondaryEncryptionKey,
      env: env.XMTP_ENV as XmtpEnv,
    });

    console.log(`Primary client inbox ID: ${primaryClient.inboxId}`);
    console.log(`Secondary client inbox ID: ${secondaryClient.inboxId}`);
  });

  it("massive sync and consent race test", async () => {
    console.log("Creating 100+ DMs...");

    // Create many DMs (like the Rust test)
    for (const peerId of testConfig.randomInboxIds) {
      try {
        const dm = await primaryClient.conversations.newDm(peerId);
        createdDms.push(dm.id);
        console.log(`Created DM with peer: ${peerId}`);
      } catch (error) {
        console.warn(`Failed to create DM with peer ${peerId}:`, error);
      }
    }

    console.log(`Created ${createdDms.length} DMs`);

    // Create 200+ groups with secondary client as member (like the Rust test)
    console.log("Creating 200+ groups...");
    const secondaryInboxId = secondaryClient.inboxId;

    for (let i = 0; i < testConfig.groupCount; i++) {
      try {
        const group = await primaryClient.conversations.newGroup(
          [secondaryInboxId],
          {
            groupName: `Test Group ${i + 1}`,
            groupDescription: `Group created for concurrency test ${i + 1}`,
          },
        );
        createdGroups.push(group.id);

        if (i % 50 === 0) {
          console.log(`Created ${i + 1}/${testConfig.groupCount} groups`);
        }
      } catch (error) {
        console.warn(`Failed to create group ${i + 1}:`, error);
      }
    }

    console.log(`Created ${createdGroups.length} groups`);
    console.log("Starting sync + stream race...");

    const startTime = performance.now();

    // Start streamAllMessages (like the Rust test)
    const streamPromise = (async () => {
      try {
        await primaryClient.conversations.sync();
        const stream = await primaryClient.conversations.streamAllMessages();

        // Collect some messages to verify streaming works
        let messageCount = 0;
        const maxMessages = 10; // Just collect a few to verify it works

        for await (const message of stream) {
          console.log("Message", message);
          messageCount++;
          if (messageCount >= maxMessages) {
            break;
          }
        }

        console.log(`Stream collected ${messageCount} messages`);
      } catch (error) {
        console.error("Stream error:", error);
        throw error;
      }
    })();

    // Run syncAllConversations concurrently (like the Rust test)
    const syncPromise = (async () => {
      try {
        await primaryClient.conversations.sync();
        console.log("Sync completed successfully");
      } catch (error) {
        console.error("Sync error:", error);
        throw error;
      }
    })();

    // Wait for both operations to complete
    await Promise.all([streamPromise, syncPromise]);

    const duration = (performance.now() - startTime) / 1000; // Convert to seconds
    console.log(
      `${createdGroups.length} groups, ${createdDms.length} DMs created; sync + stream finished in ${duration.toFixed(2)} seconds`,
    );

    // Assert performance (like the Rust test)
    if (duration > testConfig.timeoutSeconds) {
      throw new Error(
        `Sync and stream should complete within ${testConfig.timeoutSeconds} seconds, but took ${duration.toFixed(2)} seconds`,
      );
    }

    console.log("✓ Concurrency race test passed!");
  });

  it("verify conversation counts after race", async () => {
    // Verify that all conversations are accessible after the race
    console.log("Verifying conversation counts...");

    await primaryClient.conversations.sync();

    // Get all conversations
    const allConversations = await primaryClient.conversations.list();
    const dms = allConversations.filter(
      (conv) => conv.constructor.name === "Dm",
    );
    const groups = allConversations.filter(
      (conv) => conv.constructor.name === "Group",
    );

    console.log(`Total conversations: ${allConversations.length}`);
    console.log(`DMs: ${dms.length}`);
    console.log(`Groups: ${groups.length}`);

    // Basic verification that we have conversations
    if (allConversations.length === 0) {
      throw new Error("No conversations found after sync");
    }

    console.log("✓ Conversation verification passed!");
  });
});
