/**
 * worker.ts
 *
 * This file is loaded by the Worker's inline `tsImport(...)`.
 * You can do any required initialization for your worker environment here.
 */
import { parentPort, workerData } from "node:worker_threads";
import type { Client } from "@xmtp/node-sdk";

// Ensure we have parentPort
if (!parentPort) {
  throw new Error("This module must be run as a worker thread");
}

// Set up message handling from parent
parentPort.on("message", (message: { type: string; data: any }) => {
  if (message.type === "initialize") {
    // Handle initialization
    console.log("Worker initializing with data:", message.data);
  }
});

// Export for type checking
export type { Client };

// Optional: If you need a top-level await or additional logging, do it here.
// In many setups, you might not need anything special.
// The actual logic is mostly inside WorkerClient.

console.log("Worker started with workerData:", workerData);

// If you need to keep the worker alive explicitly, do so here.
// Otherwise, once the parent thread ends, the worker will close as well.
