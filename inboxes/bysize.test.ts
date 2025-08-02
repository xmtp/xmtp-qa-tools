import { getBysizeWorkerName } from "@inboxes/utils";
import {
  getRandomNames,
  getWorkers,
  type Worker,
  type WorkerManager,
} from "@workers/manager";
import { describe, it } from "vitest";

const testName = "bysize";
describe(testName, () => {
  const POPULATE_SIZE = [0, 500, 1000, 2000, 5000, 10000];
  const randomNames = getRandomNames(5);

  let workers: WorkerManager;
  let creator: Worker | undefined;
  let receiver: Worker | undefined;

  for (const populateSize of POPULATE_SIZE) {
    it(`create(${populateSize}): measure creating a client`, async () => {
      const workerNames = [...randomNames];
      if (populateSize > 0) {
        const bysizeWorkerName = getBysizeWorkerName(populateSize);
        if (!bysizeWorkerName) {
          throw new Error("Bysize worker name not found");
        }
        workerNames.unshift(bysizeWorkerName);
      }
      console.log("workerNames", workerNames);
      workers = await getWorkers(workerNames);
      creator = workers.get(workerNames[0])!;
      receiver = workers.get(randomNames[0])!;
      console.log("Creator name", creator.name);
      console.log("Receiver name", receiver.name);
    });
    it(`sync(${populateSize}):measure sync`, async () => {
      await creator!.client.conversations.sync();
    });
    it(`syncAll(${populateSize}):measure syncAll`, async () => {
      await creator!.client.conversations.syncAll();
    });
    it(`inboxState(${populateSize}):measure inboxState`, async () => {
      const inboxState = await creator!.client.preferences.inboxState();
      console.log("inboxState", creator!.name, inboxState.inboxId);
    });
  }
});
