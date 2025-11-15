import { type WorkerManager } from "@workers/manager";

export interface ChaosProvider {
  start(workers: WorkerManager): Promise<void>;
  stop(): Promise<void>;
}
