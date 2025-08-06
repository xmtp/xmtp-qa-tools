import { verifyMessageStream } from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { getVersions } from "version-management/client-versions";
import { describe, expect, it } from "vitest";

const testName = "clients";
describe(testName, () => {
  setupDurationTracking({ testName });

  it(`downgrade last versions`, async () => {
    for (const version of getVersions().slice(0, 3)) {
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
    }
  });
});
