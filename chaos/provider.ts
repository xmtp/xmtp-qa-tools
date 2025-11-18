import { type WorkerManager } from "@workers/manager";

// Generic interface for the Chaos Provider.
// A Chaos Provider is started after the test has been setup, but before we start performing actions
// It is stopped after the core of the test has been completed, and should remove all chaos so that final
// validations can be performed cleanly.
export interface ChaosProvider {
  start(workers: WorkerManager): Promise<void>;
  stop(): Promise<void>;
}
