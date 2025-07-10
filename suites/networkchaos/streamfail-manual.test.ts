import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "stream-timeout-monitor";
const NODE_VERSION = "3.1.2";

describe(testName, async () => {
  setupTestLifecycle({ testName });

  const workers = await getWorkers(
    {
      user1: "http://localhost:5556",
    },
    {
      nodeVersion: NODE_VERSION,
    }
  );


  const user1 = workers.get("user1");
  if (!user1) {
    throw new Error("User1 not found in workers");
  }

  it("should monitor stream and log any disconnects", async () => {
    console.log("[test] Starting long-lived stream...");
    user1.worker.startStream(typeofStream.Message);

    console.log("[test] Stream started. Kill a node now and watch the logs.");

    process.on("unhandledRejection", (err) => {
      console.error("[stream] Unhandled rejection:", err);
    });

    process.on("uncaughtException", (err) => {
      console.error("[stream] Uncaught exception:", err);
    });

    // Keep the test running forever
    await new Promise(() => { });
  });
});
