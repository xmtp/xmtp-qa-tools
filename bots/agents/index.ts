import { loadEnv } from "@helpers/client";
import { getWorkers } from "@workers/manager";

const testName = "test-bot";
loadEnv(testName);
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});
async function main() {
  console.log("Attempting to initialize GPT workers...");
  const workersGpt = await getWorkers(
    ["sam", "tina", "walt"],
    testName,
    "message",
    "gpt",
  );
  console.log("GPT workers:", workersGpt.getWorkers().length);
  for (const worker of workersGpt.getWorkers()) {
    console.log("GPT workers:", worker.name, worker.address);
  }
  console.log(
    workersGpt
      .getWorkers()
      .map((w) => w.address)
      .join(", "),
  );
  return workersGpt;
}

main().catch(console.error);
