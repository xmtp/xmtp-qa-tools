import { sleep } from "@helpers/client";
import { setupDurationTracking } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { type DecodedMessage } from "version-management/client-versions";
import { describe, expect, it } from "vitest";

const testName = "clients";
describe(testName, () => {
  setupDurationTracking({ testName });

  it("check stream restart (prev 4.0.2 bug)", async () => {
    const agentWorkers = await getWorkers(1);
    const agent = agentWorkers.getCreator();
    let messageCount = 0;

    // First test
    let talkerWorkers = await getWorkers(1);
    let creator = talkerWorkers.getCreator();
    let convo = await creator.client.conversations.newDm(agent.inboxId);

    let stream = await agent.client.conversations.streamAllMessages({
      onValue: (message: DecodedMessage) => {
        if (
          message.senderInboxId.toLowerCase() !== agent.inboxId.toLowerCase()
        ) {
          console.log("message", message.content);
          messageCount++;
          return;
        }
      },
    });
    await sleep(1000);

    await convo.send("convo1");
    await sleep(1000);
    void stream.end();

    stream = await agent.client.conversations.streamAllMessages({
      onValue: (message: DecodedMessage) => {
        if (
          message.senderInboxId.toLowerCase() !== agent.inboxId.toLowerCase()
        ) {
          console.log("message", message.content);
          messageCount++;
          return;
        }
      },
    });
    // First test
    await convo.send("convo2");
    await sleep(1000);

    expect(messageCount).toBe(2);
  });
});
