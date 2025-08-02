import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomAddress } from "@inboxes/utils";
import {
  getBysizeWorkerName,
  getBysizeWorkerNames,
  getRandomNames,
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
  let workers: WorkerManager;
  let creator: Worker | undefined;
  let receiver: Worker | undefined;

  for (const populateSize of POPULATE_SIZE) {
    it(`create(${populateSize}): measure creating a client`, async () => {
      const bysizeWorkerName = getBysizeWorkerName(populateSize);
      if (!bysizeWorkerName) {
        throw new Error("Bysize worker name not found");
      }
      workers = await getWorkers([bysizeWorkerName, ...getRandomNames(6)]);
      creator = workers.get("edward")!;
      receiver = workers.get("bob")!;
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
  }
});
