import { closeEnv, loadEnv } from "@helpers/client";
import { type Client } from "@helpers/types";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, it } from "vitest";

const testName = "bug_duplicates";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  let client: Client;
  // Destination inbox ID to send messages to (my xmtp.chat inbox)
  const destinationInboxId =
    "45aeedf9b01400ca72c426a725c8960140d73b9a0aba7eb8c7c45e7cef524c1f";
  // Alternative ID for testing (my convos): "ebb1d57a3bf5080e70bfd9dd69372c012ca4a95e175f6b9dacae1df4844abe04"

  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("should demonstrate DM stitch issue when client restarts", async () => {
    // Initialize worker and client
    workers = await getWorkers(["ivy"], testName);
    const ivy = workers.get("ivy");
    client = ivy?.client as Client;

    // Sync all conversations first
    await client.conversations.syncAll();

    // Create a new DM conversation and send a message
    const newConvo = await client.conversations.newDm(destinationInboxId);
    const message = `gm from ivy-a ${newConvo?.id} - ${new Date().toISOString()}`;
    console.log(`Sending message: ${message}`);
    await newConvo?.send(message);

    // Check existing conversations
    const initialConvos = await client.conversations.listDms();
    console.log(`Found ${initialConvos.length} conversations before restart`);

    if (initialConvos.length > 0) {
      // Simulate client restart by clearing local data
      console.warn(
        "Simulating client restart: clearing local data and restarting",
      );
      ivy?.worker.clearDB();

      // After restart, create a new conversation to the same recipient
      // This would normally be expected to find the existing conversation
      const restartedClient = ivy?.client as Client;
      await restartedClient.conversations.syncAll();

      const newConvoAfterRestart =
        await restartedClient.conversations.newDm(destinationInboxId);
      const secondMessage = `gm after restart ${newConvoAfterRestart?.id} - ${new Date().toISOString()}`;
      console.log(`Sending second message: ${secondMessage}`);
      await newConvoAfterRestart?.send(secondMessage);

      // List conversations again to check for duplicates
      const convoAfterRestart = await restartedClient.conversations.listDms();
      console.log(
        `Found ${convoAfterRestart.length} conversations after restart`,
      );

      // Log conversation IDs to verify duplication
      console.log(
        "Conversation IDs:",
        convoAfterRestart.map((c) => c.id),
      );
    } else {
      // If no conversations were found initially (unlikely), create one
      const newConvo = await client.conversations.newDm(destinationInboxId);
      const message = `gm from ivy-a ${newConvo?.id} - ${new Date().toISOString()}`;
      console.log(`Sending message: ${message}`);
      await newConvo?.send(message);
    }
  });
});
