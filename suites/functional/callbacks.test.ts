import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { type Dm } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "callbacks";
loadEnv(testName);

describe(testName, async () => {
  const workers = await getWorkers(
    [
      "henry",
      "ivy",
      "jack",
      "karen",
      "randomguy",
      "randomguy2",
      "larry",
      "mary",
      "nancy",
      "oscar",
    ],
    testName,
    typeofStream.Message,
  );
  let convo: Dm;

  setupTestLifecycle({
    expect,
  });

  it("newDm: should measure creating a DM", async () => {
    try {
      convo = (await workers
        .get("henry")!
        .client.conversations.newDm(
          workers.get("randomguy")!.client.inboxId,
        )) as Dm;

      const ivyClient = workers.get("ivy")!.client;
      const msgId = await convo.send("hi");
      const ivyConversation = await ivyClient.conversations.streamAllMessages();
      for await (const message of ivyConversation) {
        if (message?.conversationId === msgId) {
          expect(message.content).toBe("hi");
          break;
        }
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  // it("add member to group", async () => {
  //   try {
  //     const conversationStream = await workers
  //       .get("henry")!
  //       .client.conversations.stream();
  //     for await (const conversation of conversationStream) {
  //       if (conversation?.id === groupId) {
  //         expect(conversation.id).toBe(groupId);
  //         break;
  //       } else {
  //         expect(conversation?.id).toBeDefined();
  //       }
  //     }
  //   } catch (e) {
  //     logError(e, expect.getState().currentTestName);
  //     throw e;
  //   }
  // });
});
