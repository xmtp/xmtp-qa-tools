import { verifyMessageStream } from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "clients";
describe(testName, () => {
  setupDurationTracking({ testName });

  // for (const version of getVersions().slice(0, 3)) {
  //   it(`downgrade to ${version.nodeSDK}`, async () => {
  //     try {
  //       await new Promise((resolve) => setTimeout(resolve, 1000));
  //       const versionWorkers = await getWorkers(["creator", "receiver"], {
  //         nodeSDK: version.nodeSDK,
  //       });

  //       const creator = versionWorkers.getCreator();
  //       const receiver = versionWorkers.getReceiver();
  //       let convo = await creator.client.conversations.newDm(receiver.inboxId);
  //       const verifyResult = await verifyMessageStream(convo, [receiver]);
  //       expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(99);
  //     } catch (error) {
  //       console.error("Error downgrading to version", version.nodeSDK, error);
  //     }
  //   });
  // }
  // for (const version of getVersions().slice(0, 3).reverse()) {
  //   it(`upgrade to ${version.nodeSDK}`, async () => {
  //     try {
  //       await new Promise((resolve) => setTimeout(resolve, 1000));
  //       const versionWorkers = await getWorkers(["creator", "receiver"], {
  //         nodeSDK: version.nodeSDK,
  //       });

  //       const creator = versionWorkers.getCreator();
  //       const receiver = versionWorkers.getReceiver();
  //       let convo = await creator.client.conversations.newDm(receiver.inboxId);
  //       const verifyResult = await verifyMessageStream(convo, [receiver]);
  //       expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(99);
  //     } catch (error) {
  //       console.error("Error upgrading to version", version.nodeSDK, error);
  //     }
  //   });
  // }
  it("check client restart", async () => {
    const versionWorkers = await getWorkers(2);
    const creator = versionWorkers.getCreator();
    const receiver = versionWorkers.getReceiver();
    let convo = await creator.client.conversations.newDm(receiver.inboxId);
    const verifyResult = await verifyMessageStream(convo, [receiver]);
    expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(99);
    await versionWorkers.terminateAll();
    const verifyResult2 = await verifyMessageStream(convo, [receiver]);
    expect(verifyResult2.receptionPercentage).toBeGreaterThanOrEqual(99);
  });
});
