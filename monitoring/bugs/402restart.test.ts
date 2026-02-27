import { isDecodedMessage, sendTextCompat } from "@helpers/sdk-compat";
import { type DecodedMessage, type Message } from "@helpers/versions";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

/**
 * Poll until the receivedMessages array reaches the expected length,
 * checking every 200ms up to the given timeout (default 10s).
 */
async function waitForMessages(
  receivedMessages: string[],
  expectedCount: number,
  timeoutMs = 10000,
): Promise<void> {
  const start = Date.now();
  while (
    receivedMessages.length < expectedCount &&
    Date.now() - start < timeoutMs
  ) {
    await new Promise((r) => setTimeout(r, 200));
  }
}

const testName = "clients";
describe(testName, () => {
  it("check stream restart (prev 4.0.2 bug)", async () => {
    const agentWorkers = await getWorkers(1);
    const agent = agentWorkers.mustGetCreator();
    const receivedMessages: string[] = [];

    // First test
    let talkerWorkers = await getWorkers(1);
    let creator = talkerWorkers.mustGetCreator();
    let convo = await creator.client.conversations.createDm(agent.inboxId);

    let stream = await agent.client.conversations.streamAllMessages({
      onValue: (message: Message | DecodedMessage) => {
        if (
          isDecodedMessage(message) &&
          message.senderInboxId.toLowerCase() !== agent.inboxId.toLowerCase()
        ) {
          console.log("message", message.content);
          receivedMessages.push(message.content as string);
          return;
        }
      },
    });

    await sendTextCompat(convo, "convo1");
    await waitForMessages(receivedMessages, 1);
    await stream.end();

    stream = await agent.client.conversations.streamAllMessages({
      onValue: (message: Message | DecodedMessage) => {
        if (
          isDecodedMessage(message) &&
          message.senderInboxId.toLowerCase() !== agent.inboxId.toLowerCase()
        ) {
          console.log("message", message.content);
          receivedMessages.push(message.content as string);
          return;
        }
      },
    });
    // Second test
    await sendTextCompat(convo, "convo2");
    await waitForMessages(receivedMessages, 2);

    expect(receivedMessages.length).toBe(2);
    expect(receivedMessages).toContain("convo2");
  });
});
