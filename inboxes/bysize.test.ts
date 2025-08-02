import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomAddress } from "@inboxes/utils";
import {
  getBysizeWorkerName,
  getBysizeWorkerNames,
  getWorkers,
  type Worker,
  type WorkerManager,
} from "@workers/manager";
import { Client, IdentifierKind, type Dm } from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "bysize";
describe(testName, () => {
  // Get available bysize sizes from the bysize.json file
  const availableBysizeSizes = getBysizeWorkerNames()
    .map((name) => {
      const match = name.match(/bysize(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((size) => size > 0);

  // Use available bysize sizes, fallback to [0, 500] if none available
  const POPULATE_SIZE =
    availableBysizeSizes.length > 0 ? availableBysizeSizes : [0, 500];

  console.log(
    `Testing bysize performance with sizes: ${POPULATE_SIZE.join(", ")}`,
  );

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
    let usingBysizeWorker = false;

    it(`create(${populateSize}): measure creating a client`, async () => {
      // Always initialize 6 workers first
      workers = await getWorkers(6, {
        randomNames: false,
      });

      // Get the bysize worker name for this populate size
      const bysizeWorkerName = getBysizeWorkerName(populateSize);

      if (bysizeWorkerName) {
        console.log(
          `Attempting to create bysize worker: ${bysizeWorkerName} for size ${populateSize}`,
        );

        // Create the bysize worker separately
        const bysizeWorkers = await getWorkers([bysizeWorkerName], {
          randomNames: false,
        });
        const bysizeWorker = bysizeWorkers.get(bysizeWorkerName);

        if (bysizeWorker) {
          creator = bysizeWorker;
          usingBysizeWorker = true;
          console.log(
            `✓ Successfully created bysize worker for size ${populateSize}`,
          );
        } else {
          console.log(
            `Failed to get bysize worker for size ${populateSize}, using regular worker`,
          );
          creator = workers.get("edward")!;
          usingBysizeWorker = false;
        }
      } else {
        // No bysize worker found, use regular worker
        console.log(
          `No bysize worker found for size ${populateSize}, using regular worker`,
        );
        creator = workers.get("edward")!;
        usingBysizeWorker = false;
      }

      // Always use a regular worker as receiver
      receiver = workers.get("bob")!;

      const workerType = usingBysizeWorker ? "bysize" : "regular";
      console.log(
        `Measuring client creation for size ${populateSize} using ${workerType} worker`,
      );
      setCustomDuration(creator.initializationTime);
    });

    it(`canMessage(${populateSize}):measure canMessage`, async () => {
      if (!receiver) {
        throw new Error("Receiver not initialized");
      }
      const randomAddress = receiver.address;
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
        receiver.env,
      );
      setCustomDuration(Date.now() - start);
      expect(canMessage.get(randomAddress.toLowerCase())).toBe(true);
    });

    it(`newDm(${populateSize}):measure creating a DM`, async () => {
      if (!creator || !receiver) {
        throw new Error("Creator or receiver not initialized");
      }
      dm = (await creator.client.conversations.newDm(
        receiver.client.inboxId,
      )) as Dm;
      expect(dm).toBeDefined();
      expect(dm.id).toBeDefined();
    });

    it(`newDmByAddress(${populateSize}):measure creating a DM`, async () => {
      if (!receiver) {
        throw new Error("Receiver not initialized");
      }
      const dm2 = await receiver.client.conversations.newDmWithIdentifier({
        identifier: getRandomAddress(1)[0],
        identifierKind: IdentifierKind.Ethereum,
      });

      expect(dm2).toBeDefined();
      expect(dm2.id).toBeDefined();
    });
  } // Close the for loop
}); // Close the describe block
