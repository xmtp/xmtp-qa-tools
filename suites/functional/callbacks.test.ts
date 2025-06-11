import { getRandomNames, loadEnv, sleep } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { type DecodedMessage, type Dm, type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "callbacks";
loadEnv(testName);

describe(testName, async () => {
  const names = getRandomNames(5);
  const workers = await getWorkers(names, testName);
  let convo: Dm;

  setupTestLifecycle({
    expect,
  });

  it("awaitStreamMessage: should measure creating a DM and sending a message", async () => {
    try {
      const sender = workers.get(names[0])!;
      const receiver = workers.get(names[1])!;
      convo = (await sender.client.conversations.newDm(
        receiver.client.inboxId,
      )) as Dm;
      const receiverConversation =
        await receiver.client.conversations.streamAllMessages();

      await convo.send("1");
      for await (const message of receiverConversation) {
        try {
          if (message?.conversationId === convo.id) {
            console.log("message", message.content);
            expect(message.content).toBe("1");
            break;
          }
        } catch (e) {
          logError(e, expect.getState().currentTestName);
          throw e;
        }
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("callbackMessageStream: should measure creating a DM and sending a message", async () => {
    try {
      const sender = workers.get(names[2])!;
      const receiver = workers.get(names[1])!;
      convo = (await sender.client.conversations.newDm(
        receiver.client.inboxId,
      )) as Dm;

      receiver.client.conversations
        .streamAllMessages((err, message) => {
          if (err) throw err;
          if (message?.conversationId === convo.id) {
            console.log("message", message.content);
            expect(message.content).toBe("1");
            return;
          } else {
            throw new Error("Message not found");
          }
        })
        .catch((e: unknown) => {
          logError(e, expect.getState().currentTestName);
          throw e;
        });
      await sleep(1000);
      await convo.send("1");
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("awaitStreamConversation: should measure creating a DM and sending a message", async () => {
    try {
      const receiver = workers.get(names[1])!;
      const stream = receiver.client.conversations.stream();
      const convo = await workers.createGroup();
      for await (const conversation of stream) {
        try {
          if (conversation?.id === convo.id) {
            console.log("conversation", conversation.id);
            expect(conversation.id).toBe(convo.id);
            break;
          }
        } catch (e) {
          logError(e, expect.getState().currentTestName);
          throw e;
        }
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it("callbackStreamConversation: should measure creating a DM and sending a message", async () => {
    try {
      const receiver = workers.get(names[1])!;
      receiver.client.conversations.stream((err, conversation) => {
        if (err) {
          console.log("error", err);
          return;
        }
        if (conversation?.id) {
          console.log("conversation", conversation.id);
          expect(conversation.id).toBeDefined();
          return;
        } else {
          console.log("conversation", err);
        }
      });
      await workers.createGroup();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
