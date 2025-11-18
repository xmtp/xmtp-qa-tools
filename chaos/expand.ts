import type { ChaosProvider } from "@chaos/provider";
import { getDefaultSdkVersion, type Group } from "@helpers/versions";
import { getRandomNames, type WorkerManager } from "@workers/manager";

export type ExpandGroupConfig = {
  interval: number; // Milliseconds between expanding the group
};

export class ExpandGroup implements ChaosProvider {
  config: ExpandGroupConfig;

  interval?: NodeJS.Timeout;
  workers?: WorkerManager;

  constructor(config: ExpandGroupConfig) {
    this.config = config;
  }

  private async addWorker() {
    if (!this.workers) {
      throw new Error("WorkerManager is not initialized");
    }

    const creator = this.workers.getCreator();
    const newWorkerName = getRandomNames(1)[0];

    const newWorker = await this.workers.createWorker(
      newWorkerName,
      getDefaultSdkVersion(),
    );

    console.log(`Created worker ${newWorkerName}`);

    const allGroups = creator.client.conversations.listGroups();
    for (const group of allGroups) {
      await group.addMembers([newWorker.inboxId]);
      await newWorker.client.conversations.sync();
      const workerGroup =
        (await newWorker.client.conversations.getConversationById(
          group.id,
        )) as Group;
      if (!workerGroup || !workerGroup.updateDescription) {
        throw new Error("Worker group is not initialized");
      }
      await workerGroup.updateDescription(`Worker ${newWorkerName} was here`);
    }

    console.log(`Added worker ${newWorkerName} to all groups`);
  }

  start(workers: WorkerManager) {
    this.workers = workers;

    this.interval = setInterval(async () => {
      try {
        await this.addWorker();
      } catch (error) {
        console.error("Error expanding group:", error);
      }
    }, this.config.interval);

    return Promise.resolve();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }

    return Promise.resolve();
  }
}
