import { loadEnv } from "@helpers/client";
import { getWorkers } from "@workers/manager";

const testName = "test-bot";
loadEnv(testName);
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection details:", reason);
  if (reason instanceof Error) {
    console.error("Error message:", reason.message);
    console.error("Error stack:", reason.stack);
  }
  process.exit(1);
});
async function main() {
  console.log("Attempting to initialize GPT workers...");
  try {
    const workersGpt = await getWorkers(
      ["sam", "tina", "walt"],
      testName,
      "message",
      "gpt",
    );
    console.log("GPT workers:", workersGpt.getWorkers().length);
    for (const worker of workersGpt.getWorkers()) {
      console.log(
        "GPT worker:",
        worker.name,
        worker.address,
        "inboxId:",
        worker.inboxId,
      );

      // Add sync log to track if sync causes issues
      worker.client.conversations
        .sync()
        .then(() => {
          console.log(`${worker.name}: Initial sync completed`);
        })
        .catch((err: unknown) => {
          console.error(`${worker.name}: Sync error:`, err);
        });
    }

    console.log(
      workersGpt
        .getWorkers()
        .map((w) => w.address)
        .join(", "),
    );

    // Keep the process running
    return workersGpt;
  } catch (error: unknown) {
    console.error("Error in main function:", error);
    throw error;
  }
}

main().catch(console.error);
