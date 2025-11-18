import type { ChaosProvider } from "@chaos/provider";
import { typeofStream, type WorkerClient } from "@workers/main";
import type { WorkerManager } from "@workers/manager";

export type StreamsConfig = {
  cloned: boolean; // Should the stream be run against the workers used in the tests, or a cloned client instance?
};

export class StreamsChaos implements ChaosProvider {
  workers?: WorkerClient[];
  config: StreamsConfig;

  constructor(config: StreamsConfig) {
    this.config = config;
  }

  async start(workers: WorkerManager) {
    console.log("Starting StreamsChaos");
    let allWorkers = workers.getAll().map((w) => w.worker);
    if (this.config.cloned) {
      allWorkers = await Promise.all(allWorkers.map((w) => w.clone()));
    }

    this.workers = allWorkers;
    for (const worker of allWorkers) {
      worker.startStream(typeofStream.Message);
    }

    return Promise.resolve();
  }

  stop() {
    if (this.workers) {
      for (const worker of this.workers) {
        worker.stopStreams();
      }
    }

    return Promise.resolve();
  }
}
