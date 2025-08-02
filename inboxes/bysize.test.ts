import { getBysizeWorkerName, getBysizeWorkerNames } from "@inboxes/utils";
import {
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

  const randomNames = getRandomNames(5);

  let workers: WorkerManager;
  let creator: Worker | undefined;
  let receiver: Worker | undefined;

  for (const populateSize of POPULATE_SIZE) {
    it(`create(${populateSize}): measure creating a client`, async () => {
      const bysizeWorkerName = getBysizeWorkerName(populateSize);
      if (!bysizeWorkerName) {
        throw new Error("Bysize worker name not found");
      }
      const workerNames = [bysizeWorkerName, ...randomNames];
      console.log("workerNames", workerNames);
      workers = await getWorkers(workerNames);
      creator = workers.get(bysizeWorkerName)!;
      receiver = workers.get(randomNames[0])!;
    });
  }
});
