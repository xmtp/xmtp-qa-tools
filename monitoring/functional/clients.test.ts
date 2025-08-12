import { sleep } from "@helpers/client";
import { verifyMessageStream } from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import {
  getVersions,
  type DecodedMessage,
} from "version-management/client-versions";
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

  for (const version of getVersions().slice(0, 3)) {
    it(`downgrade to ${version.nodeSDK}`, async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const versionWorkers = await getWorkers(["creator", "receiver"], {
          nodeSDK: version.nodeSDK,
        });

        const creator = versionWorkers.getCreator();
        const receiver = versionWorkers.getReceiver();
        let convo = await creator.client.conversations.newDm(receiver.inboxId);
        const verifyResult = await verifyMessageStream(convo, [receiver]);
        expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(99);
      } catch (error) {
        console.error("Error downgrading to version", version.nodeSDK, error);
      }
    });
  }
  for (const version of getVersions().slice(0, 3).reverse()) {
    it(`upgrade to ${version.nodeSDK}`, async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const versionWorkers = await getWorkers(["creator", "receiver"], {
          nodeSDK: version.nodeSDK,
        });

        const creator = versionWorkers.getCreator();
        const receiver = versionWorkers.getReceiver();
        let convo = await creator.client.conversations.newDm(receiver.inboxId);
        const verifyResult = await verifyMessageStream(convo, [receiver]);
        expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(99);
      } catch (error) {
        console.error("Error upgrading to version", version.nodeSDK, error);
      }
    });
  }
});
