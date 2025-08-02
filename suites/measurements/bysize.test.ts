
import { setupTestLifecycle } from "@helpers/vitest";
import { getAddresses, getInboxIds, getRandomAddress } from "@inboxes/utils";
import {
  getBysizeWorkerName,
  getWorkers,
  type Worker,
  type WorkerManager,
} from "@workers/manager";
import { Client, IdentifierKind, type Dm, type Group } from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "performance";
describe(testName, () => {
  const POPULATE_SIZE = process.env.POPULATE_SIZE
    ? process.env.POPULATE_SIZE.split("-").map((v) => Number(v))
    : [0, 500];
  let dm: Dm | undefined;

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
    initDataDog: true,
    sendDurationMetrics: true,
    networkStats: true,
  });

  for (const populateSize of POPULATE_SIZE) {
    let workers: WorkerManager;
    let creator: Worker | undefined;
    let receiver: Worker | undefined;

    // Get the bysize worker name for this populate size
    const bysizeWorkerName = getBysizeWorkerName(populateSize);

    it(`create(${populateSize}): measure creating a client`, async () => {
      if (bysizeWorkerName) {
        // Use the specific bysize worker for this populate size
        workers = await getWorkers([bysizeWorkerName], {
          randomNames: false,
        });
        const creatorWorker = workers.get(bysizeWorkerName);
        if (!creatorWorker) {
          throw new Error(`Failed to get worker: ${bysizeWorkerName}`);
        }
        creator = creatorWorker;
        // Create a regular worker for receiver
        const receiverWorkers = await getWorkers(["bob"], {
          randomNames: false,
        });
        receiver = receiverWorkers.get("bob")!;
      } else {
        // Fallback to regular workers if no bysize worker found
        workers = await getWorkers(6, {
          randomNames: false,
        });
        creator = workers.get("edward")!;
        receiver = workers.get("bob")!;
      }
      setCustomDuration(creator.initializationTime);
    });
    it(`canMessage(${populateSize}):measure canMessage`, async () => {
      const randomAddress = receiver!.address;
      if (!randomAddress) {
        throw new Error("Random client not found");
      }
      const start = Date.now();
      const canMessage = await Client.canMessage(
        [
          {
            identifier: randomAddress,
            identifierKind: IdentifierKind.Ethereum,
          },
        ],
        receiver!.env,
      );
      setCustomDuration(Date.now() - start);
      expect(canMessage.get(randomAddress.toLowerCase())).toBe(true);
    });

    it(`newDm(${populateSize}):measure creating a DM`, async () => {
      dm = (await creator!.client.conversations.newDm(
        receiver!.client.inboxId,
      )) as Dm;
      expect(dm).toBeDefined();
      expect(dm.id).toBeDefined();
    });
    it(`newDmByAddress(${populateSize}):measure creating a DM`, async () => {
      const dm2 = await receiver!.client.conversations.newDmWithIdentifier({
        identifier: getRandomAddress(1)[0],
        identifierKind: IdentifierKind.Ethereum,
      });

      expect(dm2).toBeDefined();
      expect(dm2.id).toBeDefined();
    });
  }
});
