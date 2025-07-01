import { getRandomNames, getWorkersWithVersions } from "@helpers/client";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { type DecodedMessage, type Dm } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "callbacks";

describe(testName, async () => {
  const names = getRandomNames(5);
  const workers = await getWorkers(getWorkersWithVersions(names));
  // Start message streams for callback verification
  workers.getAll().forEach((worker) => {
    worker.worker.startStream(typeofStream.Message);
  });

  setupTestLifecycle({
    testName,
    expect,
  });

  it("should receive messages using await async", async () => {
    const sender = workers.get(names[0])!;
    const receiver = workers.get(names[1])!;

    // Set up stream first
    const receiverConversation =
      await receiver.client.conversations.streamAllMessages();
    const messagePromise = new Promise<DecodedMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for message"));
      }, 5000);

      void (async () => {
        try {
          for await (const message of receiverConversation) {
            console.log("Stream received message:", message?.content);
            if (message?.conversationId) {
              clearTimeout(timeout);
              resolve(message as DecodedMessage);
              break;
            }
          }
        } catch (e) {
          clearTimeout(timeout);
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      })();
    });

    // Create conversation and send message after stream is ready
    const convo = (await sender.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    await convo.send("1");

    const message = await messagePromise;
    expect(message.content).toBe("1");
  });

  it("should receive messages using callback", async () => {
    const sender = workers.get(names[2])!;
    const receiver = workers.get(names[1])!;

    // Set up stream first
    const messagePromise = new Promise<DecodedMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for message"));
      }, 5000);

      void receiver.client.conversations.streamAllMessages((err, message) => {
        if (err) {
          clearTimeout(timeout);
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        console.log("Callback received message:", message?.content as string);
        if (message?.conversationId) {
          clearTimeout(timeout);
          resolve(message as DecodedMessage);
          return;
        }
      });
    });

    // Create conversation and send message after stream is ready
    const convo = (await sender.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    await convo.send("1");

    const message = await messagePromise;
    expect(message.content).toBe("1");
  });

  // it("should receive conversation with async", async () => {
  //   const receiver = workers.get(names[1])!;

  //   // Set up stream first
  //   const stream = await receiver.client.conversations.stream();
  //   const conversationPromise = new Promise<Dm>((resolve, reject) => {
  //     const timeout = setTimeout(() => {
  //       reject(new Error("Timeout waiting for conversation"));
  //     }, 5000);

  //     void (async () => {
  //       try {
  //         for await (const conversation of stream) {
  //           console.log("Stream received conversation:", conversation?.id);
  //           if (conversation?.id) {
  //             clearTimeout(timeout);
  //             resolve(conversation as Dm);
  //             break;
  //           }
  //         }
  //       } catch (e) {
  //         clearTimeout(timeout);
  //         reject(e instanceof Error ? e : new Error(String(e)));
  //       }
  //     })();
  //   });

  //   // Create group after stream is ready
  //   const convo = await workers.createGroupBetweenAll();
  //   const conversation = await conversationPromise;
  //   expect(conversation.id).toBe(convo.id);
  // });

  // it("should receive conversation with callback", async () => {
  //   const receiver = workers.get(names[1])!;

  //   // Set up stream first
  //   const conversationPromise = new Promise<Dm>((resolve, reject) => {
  //     const timeout = setTimeout(() => {
  //       reject(new Error("Timeout waiting for conversation"));
  //     }, 5000);

  //     void receiver.client.conversations.stream((err, conversation) => {
  //       if (err) {
  //         clearTimeout(timeout);
  //         reject(err instanceof Error ? err : new Error(String(err)));
  //         return;
  //       }
  //       console.log("Callback received conversation:", conversation?.id);
  //       if (conversation?.id) {
  //         clearTimeout(timeout);
  //         resolve(conversation as Dm);
  //         return;
  //       }
  //     });
  //   });

  //   // Create group after stream is ready
  //   await workers.createGroupBetweenAll();
  //   const conversation = await conversationPromise;
  //   expect(conversation.id).toBeDefined();
  // });
});
