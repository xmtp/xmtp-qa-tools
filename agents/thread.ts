import { parentPort, workerData } from "node:worker_threads";
import type { Client } from "@helpers/types";

// The Worker must be run in a worker thread, so confirm `parentPort` is defined
if (!parentPort) {
  throw new Error("This module must be run as a worker thread");
}

// Optional logs to see what's being passed into the worker.
console.log("[Worker] Started with workerData:", workerData);

// Listen for messages from the parent
parentPort.on("message", (message: { type: string; data: any }) => {
  switch (message.type) {
    case "initialize":
      // You can add logs or do any one-time setup here.
      console.log("[Worker] Received 'initialize' message:", message.data);
      break;

    default:
      console.log(`[Worker] Received unknown message type: ${message.type}`);
      break;
  }
});

// If you need to keep the worker alive, do so here. In many setups,
// simply running an async stream or event loop is enough.
// The actual XMTP logic runs in the parent (WorkerClient), so usually
// there is nothing else you must do here aside from listening for parent messages.

// Optional error handling for unhandled exceptions in the worker
process.on("unhandledRejection", (reason) => {
  console.error("[Worker] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Worker] Uncaught Exception:", error);
});

// Re-export anything needed in the worker environment (if necessary)
export type { Client };
