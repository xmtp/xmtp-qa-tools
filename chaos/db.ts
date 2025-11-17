import type { ChaosProvider } from "@chaos/provider";
import type { WorkerManager } from "@workers/manager";

export type DbChaosConfig = {
  minLockTime: number;
  maxLockTime: number;
  lockInterval: number;
  impactedWorkerPercentage: number; // number between 0 and 100 for what % of workers to lock on each run
};

export class DbChaos implements ChaosProvider {
  config: DbChaosConfig;
  activeLocks = new Map<string, Promise<void>>();
  interval?: NodeJS.Timeout;

  constructor(config: DbChaosConfig) {
    this.config = config;
  }

  start(workers: WorkerManager): Promise<void> {
    const { minLockTime, maxLockTime, lockInterval, impactedWorkerPercentage } =
      this.config;
    console.log(
      `Starting DB Chaos:
      Locking for ${minLockTime}ms - ${maxLockTime}ms
      Interval: ${lockInterval}ms`,
    );
    this.interval = setInterval(() => {
      for (const worker of workers.getAll()) {
        if (Math.random() * 100 > impactedWorkerPercentage) {
          continue;
        }
        const duration = Math.floor(
          minLockTime + Math.random() * (maxLockTime - minLockTime),
        );

        const lockKey = `${worker.name}-${worker.installationId}`;

        // Only lock if not already locked
        if (!this.activeLocks.has(lockKey)) {
          console.log(
            `[db-chaos] Locking ${worker.name} database for ${duration}ms`,
          );

          // Call the lockDB method on the worker and track it
          const lockPromise = worker.worker
            .lockDB(duration)
            .catch((err: unknown) => {
              console.warn(err);
            })
            .finally(() => {
              this.activeLocks.delete(lockKey);
            });

          this.activeLocks.set(lockKey, lockPromise);
        }
      }
    }, lockInterval);

    return Promise.resolve();
  }

  async stop() {
    console.log("Stopping DB Chaos");
    if (this.interval) {
      clearInterval(this.interval);
    }

    // Wait for all the existing locks to complete
    await Promise.allSettled(Array.from(this.activeLocks.values()));
  }
}
