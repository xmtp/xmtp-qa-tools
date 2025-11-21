import { sleep } from "@helpers/client";
import { getVersions, IdentifierKind, type XmtpEnv } from "@helpers/versions";
import { getWorkers, type Worker } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "agents-upgrade";
const CONVERSATION_COUNT = 1000;

describe(testName, () => {
  const env = (process.env.XMTP_ENV || "dev") as XmtpEnv;
  const versions = getVersions(true).slice(0, 3); // Get first 3 SDK versions

  if (versions.length < 3) {
    it(`${testName}: Need at least 3 SDK versions available`, () => {
      console.log(`Only ${versions.length} versions available, need 3`);
      expect(versions.length).toBeGreaterThanOrEqual(3);
    });
    return;
  }

  it(`${testName}: Upgrade 1k conversation DB through 3 SDKs`, async () => {
    const testWorkerName = "upgrade-test";

    console.log(
      `Using SDK versions: ${versions.map((v) => v.nodeBindings).join(" -> ")}`,
    );

    // Step 1: Create initial worker with first SDK version
    console.log(`Step 1: Creating worker with SDK ${versions[0].nodeBindings}`);
    let workers = await getWorkers([testWorkerName], {
      env,
      nodeBindings: versions[0].nodeBindings,
    });
    let worker = workers.get(testWorkerName);
    if (!worker) throw new Error("Worker not created");

    const workerAddress = worker.address;

    // Step 2: Populate with 1k conversations
    console.log(`Step 2: Populating ${CONVERSATION_COUNT} conversations...`);
    await populateConversations(worker, CONVERSATION_COUNT, env);

    // Verify conversations were created
    const conversationsBefore = await worker.client.conversations.list();
    console.log(`Created ${conversationsBefore.length} conversations`);
    expect(conversationsBefore.length).toBeGreaterThanOrEqual(
      CONVERSATION_COUNT - 50,
    ); // Allow some tolerance

    // Step 3: Upgrade through remaining SDK versions
    for (let i = 1; i < versions.length; i++) {
      const currentVersion = versions[i];
      console.log(
        `Step ${i + 2}: Upgrading to SDK ${currentVersion.nodeBindings}`,
      );

      // Terminate current worker (but keep the database)
      await workers.terminateAll(false);
      await sleep(2000);

      // Create new worker with same name (will reuse same keys and DB path)
      workers = await getWorkers([testWorkerName], {
        env,
        nodeBindings: currentVersion.nodeBindings,
      });
      worker = workers.get(testWorkerName);
      if (!worker) throw new Error("Worker not created after upgrade");

      // Verify database can be opened and conversations are accessible
      await worker.client.conversations.sync();
      const conversationsAfter = await worker.client.conversations.list();
      console.log(
        `After upgrade to ${currentVersion.nodeBindings}: ${conversationsAfter.length} conversations`,
      );

      expect(conversationsAfter.length).toBeGreaterThanOrEqual(
        CONVERSATION_COUNT - 50,
      );

      // Test that we can send/receive a message (basic functionality check)
      const testSender = await getWorkers(["upgrade-test-sender"], {
        env,
        nodeBindings: currentVersion.nodeBindings,
      });
      const sender = testSender.get("upgrade-test-sender");
      if (!sender) throw new Error("Test sender not created");

      const testDm = await sender.client.conversations.newDmWithIdentifier({
        identifier: workerAddress,
        identifierKind: IdentifierKind.Ethereum,
      });

      await testDm.send("test message after upgrade");
      await sleep(2000);

      const messages = await testDm.messages();
      expect(messages.length).toBeGreaterThan(0);

      // Cleanup test sender
      await testSender.terminateAll(true);
    }

    // Final cleanup
    await workers.terminateAll(true);
    console.log(`${testName}: Upgrade test completed successfully`);
  });
});

async function populateConversations(
  worker: Worker,
  count: number,
  env: XmtpEnv,
): Promise<void> {
  const BATCH_SIZE = 50;
  const totalBatches = Math.ceil(count / BATCH_SIZE);
  let totalCreated = 0;

  console.log(
    `Populating ${count} conversations in ${totalBatches} batches...`,
  );

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * BATCH_SIZE;
    const endIndex = Math.min(startIndex + BATCH_SIZE, count);
    const batchSize = endIndex - startIndex;

    // Create batch of sender workers
    const batchWorkerNames = Array.from(
      { length: batchSize },
      (_, i) => `upgrade-sender-${startIndex + i}`,
    );

    const senders = await getWorkers(batchWorkerNames, {
      env,
      nodeBindings: worker.sdk,
    });
    const senderWorkers = senders.getAll();

    // Create conversations for this batch
    await Promise.all(
      senderWorkers.map(async (sender) => {
        try {
          await sender.client.conversations.newDmWithIdentifier({
            identifier: worker.address,
            identifierKind: IdentifierKind.Ethereum,
          });
          totalCreated++;
        } catch (error) {
          console.warn(`Failed to create conversation: ${error as string}`);
        }
      }),
    );

    // Sync after each batch
    await worker.client.conversations.sync();

    // Cleanup batch workers
    await senders.terminateAll(true);

    if ((batchIndex + 1) % 10 === 0) {
      console.log(`Progress: ${totalCreated}/${count} conversations created`);
    }
  }

  // Final sync
  await worker.client.conversations.sync();
  console.log(`Populated ${totalCreated} conversations`);
}
