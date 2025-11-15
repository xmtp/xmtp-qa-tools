import type { ChaosProvider } from "@chaos/provider";
import { typeofStream } from "@workers/main";
import type { WorkerManager } from "@workers/manager";

export class StreamsChaos implements ChaosProvider {
  workers?: WorkerManager;
  start(workers: WorkerManager) {
    console.log("Starting StreamsChaos");
    this.workers = workers;
    for (const worker of workers.getAll()) {
      worker.worker.startStream(typeofStream.Message);
    }

    return Promise.resolve();
  }

  stop() {
    if (this.workers) {
      for (const worker of this.workers.getAll()) {
        worker.worker.stopStreams();
      }
    }

    return Promise.resolve();
  }
}
