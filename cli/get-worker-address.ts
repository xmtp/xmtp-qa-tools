import "dotenv/config";
import { getWorkers } from "@workers/manager";
import { type XmtpEnv } from "@workers/versions";

async function main() {
  console.log("🔍 Getting worker address for send command...");

  // Create a single worker
  const workerManager = await getWorkers(1, {
    env: "dev" as XmtpEnv,
    useVersions: false, // Use latest version
  });

  const worker = workerManager.getAll()[0];
  console.log(`📋 Worker inbox ID: ${worker.worker.client.inboxId}`);
  console.log(`📍 Worker address: ${worker.worker.address}`);
  console.log(`🌍 Environment: ${worker.env}`);

  console.log("\n💡 Use this address with the send command:");
  console.log(
    `yarn send --target ${worker.worker.address} --env ${worker.env} --users 5`,
  );

  console.log("\n📝 Example commands:");
  console.log(`# Basic send to self`);
  console.log(
    `yarn send --target ${worker.worker.address} --env ${worker.env} --users 3`,
  );

  console.log(`\n# Send with custom message`);
  console.log(
    `yarn send --target ${worker.worker.address} --env ${worker.env} --users 2 --custom-message "test-message"`,
  );

  console.log(`\n# Send and wait for responses`);
  console.log(
    `yarn send --target ${worker.worker.address} --env ${worker.env} --users 1 --wait`,
  );

  // Clean up
  await workerManager.terminateAll(true);
}

void main();
