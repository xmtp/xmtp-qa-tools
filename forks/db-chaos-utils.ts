import type { Worker } from "@workers/manager";

// Store active lock promises for cleanup
const activeLocks = new Map<string, Promise<void>>();

/**
 * Applies database lock chaos to a random selection of workers
 * @param allWorkers - Array of workers to potentially lock
 * @param lockDurationMin - Minimum lock duration in ms
 * @param lockDurationMax - Maximum lock duration in ms
 */
const applyDbChaos = (
  allWorkers: Worker[],
  lockDurationMin: number,
  lockDurationMax: number,
) => {
  console.log("[db-chaos] Applying database locks...");

  for (const worker of allWorkers) {
    // Randomly decide whether to lock this worker's DB (50% chance)
    if (Math.random() < 0.5) {
      const duration = Math.floor(
        lockDurationMin + Math.random() * (lockDurationMax - lockDurationMin),
      );

      const lockKey = `${worker.name}-${worker.installationId}`;

      // Only lock if not already locked
      if (!activeLocks.has(lockKey)) {
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
            activeLocks.delete(lockKey);
          });

        activeLocks.set(lockKey, lockPromise);
      }
    }
  }
};

/**
 * Starts the database chaos loop
 * @param allWorkers - Array of workers to apply chaos to
 * @param lockDurationMin - Minimum lock duration in ms
 * @param lockDurationMax - Maximum lock duration in ms
 * @param interval - How often to apply chaos in ms
 * @returns Interval ID for cleanup
 */
export const startDbChaos = (
  allWorkers: Worker[],
  lockDurationMin: number,
  lockDurationMax: number,
  interval: number,
): NodeJS.Timeout => {
  console.log(`[db-chaos] Initialized for ${allWorkers.length} workers`);
  console.log(
    `[db-chaos] Lock duration: ${lockDurationMin}-${lockDurationMax}ms, interval: ${interval}ms`,
  );

  // Function to apply chaos to workers
  const applyChaos = () => {
    applyDbChaos(allWorkers, lockDurationMin, lockDurationMax);
  };

  return setInterval(applyChaos, interval);
};

/**
 * Clears all active database locks
 */
export const clearDbChaos = async () => {
  console.log("[db-chaos] Clearing all active database locks...");

  // Wait for all active locks to complete
  if (activeLocks.size > 0) {
    console.log(`[db-chaos] Waiting for ${activeLocks.size} locks to clear...`);
    await Promise.allSettled(Array.from(activeLocks.values()));
  }

  activeLocks.clear();
  console.log("[db-chaos] Cleanup complete");
};
