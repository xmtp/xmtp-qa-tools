import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { setupTestLifecycle } from "@helpers/vitest";
import { Client, type Dm, type XmtpEnv } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "stitch";

describe(testName, () => {
  setupTestLifecycle({ testName });

  // Global variables to encapsulate shared state
  let aliceClient: Client;
  let bobClientA: Client;
  let bobClientB: Client;
  let dm: Dm; // The DM conversation

  it("setup", async () => {
    const messageTimeout = 5000; // 5 second timeout for message reception

    // Create Alice client (receiver)
    const aliceSigner = createSigner(
      process.env.WALLET_KEY_ALICE as `0x${string}`,
    );
    const aliceEncryptionKey = getEncryptionKeyFromHex(
      process.env.ENCRYPTION_KEY_ALICE!,
    );
    aliceClient = await Client.create(aliceSigner, {
      dbEncryptionKey: aliceEncryptionKey,
      env: process.env.XMTP_ENV as XmtpEnv,
    });

    // Create Bob client A (first installation)
    const bobSigner = createSigner(process.env.WALLET_KEY_BOB as `0x${string}`);
    const bobEncryptionKey = getEncryptionKeyFromHex(
      process.env.ENCRYPTION_KEY_BOB!,
    );
    bobClientA = await Client.create(bobSigner, {
      dbEncryptionKey: bobEncryptionKey,
      env: process.env.XMTP_ENV as XmtpEnv,
      dbPath: ".data/bob-a", // Separate database path for installation A
    });

    // Create DM from first installation
    dm = (await bobClientA.conversations.newDm(aliceClient.inboxId)) as Dm;
    console.log("New dm created", dm.id);

    // Test first installation - should work
    const testMessage1 = "gm from installation A";

    // Start streaming messages on receiver
    await aliceClient.conversations.sync();
    const stream = aliceClient.conversations.streamAllMessages();

    let receivedMessages: any[] = [];
    const messagePromise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, messageTimeout);

      void stream.then(async (messageStream) => {
        for await (const message of messageStream) {
          if (
            message.conversationId === dm.id &&
            message.content === testMessage1
          ) {
            clearTimeout(timeout);
            receivedMessages.push(message);
            resolve(true);
            break;
          }
        }
      });
    });

    // Send message from first installation
    await dm.send(testMessage1);

    // Wait for message to be received
    const firstResult = await messagePromise;
    expect(firstResult).toBe(true);
    console.log("First installation test passed");

    // Create Bob client B (second installation - same user, different installation)
    bobClientB = await Client.create(bobSigner, {
      dbEncryptionKey: bobEncryptionKey,
      env: process.env.XMTP_ENV as XmtpEnv,
      dbPath: ".data/bob-b", // Separate database path for installation B
    });

    // Create DM from second installation
    dm = (await bobClientB.conversations.newDm(aliceClient.inboxId)) as Dm;
    console.log("New dm created", dm.id);

    // Test second installation - should fail
    const testMessage2 = "gm from installation B";

    // Start streaming for second test
    await aliceClient.conversations.sync();
    const stream2 = aliceClient.conversations.streamAllMessages();

    let receivedMessages2: any[] = [];
    const messagePromise2 = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, messageTimeout);

      void stream2.then(async (messageStream) => {
        for await (const message of messageStream) {
          if (
            message.conversationId === dm.id &&
            message.content === testMessage2
          ) {
            clearTimeout(timeout);
            receivedMessages2.push(message);
            resolve(true);
            break;
          }
        }
      });
    });

    // Send message from second installation
    await dm.send(testMessage2);

    // Wait for message - should timeout/fail
    const secondResult = await messagePromise2;

    // This should fail - the receiver won't get the message from the new installation
    expect(secondResult).toBe(true);
    console.log("Second installation test failed as expected (bug reproduced)");
  });
});
