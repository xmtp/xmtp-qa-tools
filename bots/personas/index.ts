import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";

async function main() {
  console.log("Attempting to initialize GPT workers...");
  try {
    const workersGpt = await getWorkers(
      ["sam", "tina", "walt"],
      "test-bot",
      typeofStream.Message,
      typeOfResponse.Gpt,
    );
    for (const worker of workersGpt.getAll()) {
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
        .getAll()
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
