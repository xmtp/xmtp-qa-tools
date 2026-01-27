import { sleep } from "@helpers/client";
import { isDecodedMessage, sendTextCompat } from "@helpers/sdk-compat";
import { type DecodedMessage, type Message } from "@helpers/versions";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "clients";
describe(testName, () => {
  it("check stream restart (prev 4.0.2 bug)", async () => {
    const agentWorkers = await getWorkers(1);
    const agent = agentWorkers.getCreator();
    let messageCount = 0;

    // First test
    let talkerWorkers = await getWorkers(1);
    let creator = talkerWorkers.getCreator();
    let convo = await creator.client.conversations.createDm(agent.inboxId);

    let stream = await agent.client.conversations.streamAllMessages({
      onValue: (message: Message | DecodedMessage) => {
        if (
          isDecodedMessage(message) &&
          message.senderInboxId.toLowerCase() !== agent.inboxId.toLowerCase()
        ) {
          console.log("message", message.content);
          messageCount++;
          return;
        }
      },
    });
    await sleep(1000);

    await sendTextCompat(convo, "convo1");
    await sleep(1000);
    void stream.end();

    stream = await agent.client.conversations.streamAllMessages({
      onValue: (message: Message | DecodedMessage) => {
        if (
          isDecodedMessage(message) &&
          message.senderInboxId.toLowerCase() !== agent.inboxId.toLowerCase()
        ) {
          console.log("message", message.content);
          messageCount++;
          return;
        }
      },
    });
    // First test
    await sendTextCompat(convo, "convo2");
    await sleep(1000);

    expect(messageCount).toBe(2);
  });
});
