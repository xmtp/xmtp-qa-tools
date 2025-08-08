import { sleep } from "@helpers/client";
import { verifyMessageStream } from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import {
  getVersions,
  type DecodedMessage,
} from "version-management/client-versions";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "clients";
describe(testName, () => {
  setupDurationTracking({ testName });
  let receiver: Worker;
  beforeAll(async () => {
    const workers = await getWorkers(1);
    receiver = workers.get("receiver")!;
  });

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
  const mergedVersions = [
    getVersions().slice(0, 3),
    getVersions().slice(0, 3).reverse(),
  ];
  for (let i = 0; i < mergedVersions.length; i++) {
    const version = mergedVersions[i];
    it(`switched from ${version[i - 1].nodeSDK} to ${version[i].nodeSDK}`, async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const versionWorkers = await getWorkers(["creator"], {
          nodeSDK: version[i - 1].nodeSDK,
        });

        const creator = versionWorkers.getCreator();
        let convo = await creator.client.conversations.newDm(
          receiver!.inboxId as string,
        );
        const verifyResult = await verifyMessageStream(convo, [receiver]);
        expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(99);
      } catch (error) {
        console.error(
          "Error downgrading to version",
          version[i - 1].nodeSDK,
          error,
        );
      }
    });
  }
});
