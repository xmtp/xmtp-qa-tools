import { loadEnv } from "@helpers/client";
import { getWorkers } from "@workers/manager";

const testName = "test-bot";
loadEnv(testName);

async function main() {
  try {
    // First check if OPENAI_API_KEY is configured
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "OPENAI_API_KEY is not set in environment variables. GPT workers may not function properly.",
      );
    }

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
  } catch (error) {
    console.error(
      "Failed to initialize GPT workers:",
      error instanceof Error ? error.message : String(error),
    );
    console.error("Error details:", error);
    // Don't crash the whole application if GPT workers fail
    console.log("Continuing without GPT workers");
    return null;
  }
}

main().catch(console.error);
