/**
 * RAW Stream Visibility Test - PURE STREAMING, NO POLLING
 * 
 * This test simulates the REAL user experience:
 * 1. Client2 opens their app and starts listening to streams (like a user would)
 * 2. Client2 just sits there - NO SYNCING, NO POLLING, just waiting
 * 3. Client1 creates a group and sends a message
 * 4. Client2 should receive it PURELY through the stream push
 * 
 * NO CHEATING:
 * - Client2 does NOT sync after stream starts
 * - Client2 has NO knowledge that a message is coming
 * - Client2 is purely passive - just listening
 */
import { sleep } from "@helpers/client";
import { isD14NEnabled, type Group } from "@helpers/versions";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "stream-visibility-raw";

describe(testName, () => {
  let workers: WorkerManager;
  let client1: any; // Sender
  let client2: any; // Receiver
  let worker1: any;
  let worker2: any;

  beforeAll(async () => {
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════════════╗");
    console.log("║           RAW STREAM VISIBILITY TEST                             ║");
    console.log("║           PURE STREAMING - NO POLLING - NO CHEATING              ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝");
    console.log("");

    // Show D14N configuration
    const d14nEnabled = isD14NEnabled();
    const apiUrl = process.env.XMTP_API_URL;
    console.log(`[CONFIG] D14N Mode: ${d14nEnabled ? "ENABLED" : "DISABLED"}`);
    console.log(`[CONFIG] API URL: ${apiUrl || "default"}`);
    console.log(`[CONFIG] Environment: ${process.env.XMTP_ENV || "dev"}`);
    console.log("");

    // Create two workers
    console.log("[SETUP] Creating two clients...");
    workers = await getWorkers(["client1", "client2"]);
    
    worker1 = workers.get("client1")!;
    worker2 = workers.get("client2")!;
    
    client1 = worker1.client;
    client2 = worker2.client;

    console.log("");
    console.log("╔══════════════════════════════════════════════════════════════════╗");
    console.log("║                        CLIENT DETAILS                            ║");
    console.log("╠══════════════════════════════════════════════════════════════════╣");
    console.log(`║  CLIENT 1 (SENDER)                                               ║`);
    console.log(`║    Address:  ${worker1.address}     ║`);
    console.log(`║    InboxID:  ${client1.inboxId} ║`);
    console.log("╠══════════════════════════════════════════════════════════════════╣");
    console.log(`║  CLIENT 2 (RECEIVER - PASSIVE LISTENER)                          ║`);
    console.log(`║    Address:  ${worker2.address}     ║`);
    console.log(`║    InboxID:  ${client2.inboxId} ║`);
    console.log("╚══════════════════════════════════════════════════════════════════╝");
    console.log("");
  });

  afterAll(async () => {
    if (workers) {
      await workers.terminateAll();
    }
  });

  it("REAL SCENARIO: client2 passively listens, client1 sends - NO POLLING", async () => {
    console.log("\n");
    console.log("════════════════════════════════════════════════════════════════════");
    console.log("  STEP 1: CLIENT2 STARTS LISTENING ON STREAM");
    console.log("  (Like a user opening their app - they just listen for messages)");
    console.log("════════════════════════════════════════════════════════════════════");
    
    const receivedMessages: any[] = [];
    let helloWorldReceived = false;
    
    // CLIENT2 STARTS STREAMING - THIS IS THE REAL DEAL
    // No sync, no polling, just pure stream listening
    console.log(`[CLIENT2] 📡 Starting message stream...`);
    console.log(`[CLIENT2] ⚠️  NO SYNC WILL HAPPEN - PURE STREAM LISTENING`);
    console.log(`[CLIENT2] ⚠️  Client2 has NO knowledge of any incoming messages`);
    
    const streamStartTime = new Date().toISOString();
    const stream = await client2.conversations.streamAllMessages();
    
    console.log(`[CLIENT2] ✅ Stream started at: ${streamStartTime}`);
    console.log(`[CLIENT2] 🎧 Now passively waiting for ANY messages...`);
    console.log(`[CLIENT2] 🚫 NO POLLING - NO SYNCING - JUST LISTENING`);
    console.log("");

    // Promise that resolves when we get the hello world message
    const messageReceivedPromise = new Promise<{content: string, latency: number}>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for message (60 seconds)"));
      }, 60000);

      (async () => {
        try {
          for await (const message of stream) {
            const receiveTime = Date.now();
            const receiveTimeISO = new Date(receiveTime).toISOString();
            
            console.log("\n");
            console.log("╔════════════════════════════════════════════════════════════════╗");
            console.log("║  🔔 CLIENT2 RECEIVED A MESSAGE VIA STREAM!                     ║");
            console.log("║  (This came through the stream - NOT from polling/sync)        ║");
            console.log("╠════════════════════════════════════════════════════════════════╣");
            console.log(`║  Receive Time (ISO): ${receiveTimeISO}            ║`);
            console.log(`║  Receive Time (ms):  ${receiveTime}                           ║`);
            console.log("╠════════════════════════════════════════════════════════════════╣");
            console.log(`║  Message ID:         ${message.id?.substring(0, 40)}...  ║`);
            console.log(`║  Conversation ID:    ${message.conversationId}                   ║`);
            console.log(`║  Sender InboxID:     ${message.senderInboxId?.substring(0, 40)}...  ║`);
            console.log("╠════════════════════════════════════════════════════════════════╣");
            console.log(`║  CONTENT TYPE: ${message.contentType?.typeId || 'unknown'}                                       ║`);
            console.log("╠════════════════════════════════════════════════════════════════╣");
            console.log(`║                                                                ║`);
            console.log(`║  📨 MESSAGE CONTENT: "${message.content}"                      ║`);
            console.log(`║                                                                ║`);
            console.log("╚════════════════════════════════════════════════════════════════╝");
            
            receivedMessages.push({
              content: message.content,
              senderInboxId: message.senderInboxId,
              conversationId: message.conversationId,
              receiveTime: receiveTime,
            });

            // Check if this is the "hello world" message
            if (message.content === "hello world") {
              helloWorldReceived = true;
              clearTimeout(timeout);
              
              // Calculate latency from the sentAt timestamp
              const sentAt = message.sentAt instanceof Date ? message.sentAt.getTime() : Date.now();
              const latency = receiveTime - sentAt;
              
              console.log("\n");
              console.log("╔════════════════════════════════════════════════════════════════╗");
              console.log("║  ✅✅✅ 'hello world' RECEIVED VIA PURE STREAM! ✅✅✅          ║");
              console.log("╚════════════════════════════════════════════════════════════════╝");
              
              resolve({ content: message.content, latency });
              break;
            }
          }
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      })();
    });

    console.log("\n");
    console.log("════════════════════════════════════════════════════════════════════");
    console.log("  STEP 2: WAIT 5 SECONDS (PROVING CLIENT2 IS JUST SITTING IDLE)");
    console.log("════════════════════════════════════════════════════════════════════");
    console.log(`[SYSTEM] Client2 is just waiting... doing NOTHING...`);
    console.log(`[SYSTEM] No sync() calls, no polling, no network requests...`);
    console.log(`[SYSTEM] Waiting 5 seconds to prove pure passive listening...`);
    
    for (let i = 5; i > 0; i--) {
      console.log(`[SYSTEM] ... ${i} seconds remaining ...`);
      await sleep(1000);
    }
    console.log(`[SYSTEM] ✅ 5 seconds passed. Client2 is still just listening.`);

    console.log("\n");
    console.log("════════════════════════════════════════════════════════════════════");
    console.log("  STEP 3: CLIENT1 CREATES GROUP AND ADDS CLIENT2");
    console.log("  (Client2 has NO IDEA this is happening!)");
    console.log("════════════════════════════════════════════════════════════════════");
    
    console.log(`[CLIENT1] Creating a new group...`);
    console.log(`[CLIENT1] Adding Client2 (${client2.inboxId.substring(0, 20)}...) to the group`);
    console.log(`[CLIENT2] 🔇 (Client2 knows NOTHING - still just passively listening)`);
    
    const group = await client1.conversations.newGroup([client2.inboxId], {
      groupName: "Surprise Group",
    }) as Group;
    
    console.log(`[CLIENT1] ✅ Group created: ${group.id}`);
    console.log(`[CLIENT1] Group name: ${group.name}`);
    
    const members = await group.members();
    console.log(`[CLIENT1] Members: ${members.length}`);
    members.forEach((m, i) => console.log(`         [${i}] ${m.inboxId.substring(0, 30)}...`));

    console.log("\n");
    console.log("════════════════════════════════════════════════════════════════════");
    console.log("  STEP 4: CLIENT1 SENDS 'hello world'");
    console.log("  (Client2 still has NO IDEA - just passively listening!)");
    console.log("════════════════════════════════════════════════════════════════════");
    
    const messageToSend = "hello world";
    const sendTime = Date.now();
    const sendTimeISO = new Date(sendTime).toISOString();
    
    console.log(`[CLIENT1] Preparing to send...`);
    console.log(`[CLIENT1] Message: "${messageToSend}"`);
    console.log(`[CLIENT1] To group: ${group.id}`);
    console.log(`[CLIENT1] Send time (ISO): ${sendTimeISO}`);
    console.log(`[CLIENT1] Send time (ms):  ${sendTime}`);
    console.log("");
    console.log(`[CLIENT1] 📤📤📤 SENDING NOW! 📤📤📤`);
    
    let sendResult;
    if (typeof group.sendText === "function") {
      sendResult = await group.sendText(messageToSend);
    } else {
      sendResult = await group.send(messageToSend);
    }
    
    const afterSendTime = Date.now();
    console.log(`[CLIENT1] ✅ Send complete!`);
    console.log(`[CLIENT1] Message ID: ${sendResult}`);
    console.log(`[CLIENT1] Send took: ${afterSendTime - sendTime}ms`);

    console.log("\n");
    console.log("════════════════════════════════════════════════════════════════════");
    console.log("  STEP 5: WAITING FOR CLIENT2 TO RECEIVE VIA STREAM...");
    console.log("  (Remember: NO sync() calls, NO polling - just pure stream push!)");
    console.log("════════════════════════════════════════════════════════════════════");
    console.log(`[CLIENT2] 🎧 Still just listening on the stream...`);
    console.log(`[CLIENT2] 🚫 NOT calling sync() - waiting for pure push notification`);

    // Wait for the message
    const result = await messageReceivedPromise;

    // Calculate actual end-to-end latency
    const endToEndLatency = Date.now() - sendTime;

    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════════════╗");
    console.log("║                    FINAL RESULTS                                 ║");
    console.log("╠══════════════════════════════════════════════════════════════════╣");
    console.log(`║  Messages sent:        1                                         ║`);
    console.log(`║  Messages received:    ${receivedMessages.length}                                         ║`);
    console.log(`║  Content received:     "${result.content}"                            ║`);
    console.log("╠══════════════════════════════════════════════════════════════════╣");
    console.log(`║  DELIVERY METHOD:      PURE STREAM (no sync/poll)                ║`);
    console.log(`║  END-TO-END LATENCY:   ${endToEndLatency}ms                                      ║`);
    console.log("╠══════════════════════════════════════════════════════════════════╣");
    console.log(`║  ✅ CONFIRMED: Message delivered via REAL-TIME STREAM            ║`);
    console.log(`║  ✅ CONFIRMED: Client2 did NOT sync() or poll                    ║`);
    console.log(`║  ✅ CONFIRMED: This is the REAL user experience!                 ║`);
    console.log("╚══════════════════════════════════════════════════════════════════╝");

    // Assertions
    expect(receivedMessages.length).toBeGreaterThan(0);
    expect(result.content).toBe("hello world");
    
  }, 120000); // 2 minute timeout
});
