import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Conversation } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "stitch";

describe(testName, () => {
  setupTestLifecycle({ testName });

  // Global variables to encapsulate shared state
  let workers: WorkerManager;
  let random1: Worker;
  let bob: Worker;
  let initialDm: any;
  let random1Fresh: Worker;

  beforeAll(async () => {
    // Initialize base workers
    workers = await getWorkers(["random1", "bob"]);
    random1 = workers.get("random1")!;
    bob = workers.get("bob")!;

    initialDm = await random1.client.conversations.newDm(bob.client.inboxId);
  });

  it("should verify message delivery works after DM stitching", async () => {
    // Send a test message and verify delivery
    const verifyResult = await verifyMessageStream(initialDm as Conversation, [
      bob,
    ]);

    // Verify message delivery works after stitching
    expect(verifyResult.allReceived).toBe(true);
    expect(verifyResult.receptionPercentage).toBeGreaterThan(95);
  });

  // it("should revoke all installations for random1", async () => {
  //   // Get current installations
  //   const currentState = await Client.inboxStateFromInboxIds(
  //     [random1.client.inboxId],
  //     (process.env.XMTP_ENV as XmtpEnv) || "dev",
  //   );

  //   const currentInstallations = currentState[0].installations;

  //   // Revoke all installations
  //   const installationsToRevokeBytes = currentInstallations.map(
  //     (installation) => installation.bytes,
  //   );

  //   if (!random1.client.signer) {
  //     throw new Error("random1 client signer is undefined");
  //   }

  //   await Client.revokeInstallations(
  //     random1.client.signer,
  //     random1.client.inboxId,
  //     installationsToRevokeBytes,
  //     (process.env.XMTP_ENV as XmtpEnv) || "dev",
  //   );
  // });

  it("should create fresh random1 client and verify DM accessibility", async () => {
    // Create fresh random1 client
    const freshrandom1 = await getWorkers(["random1-fresh"]);
    random1Fresh = freshrandom1.get("random1", "fresh")!;

    // Send a test message and verify delivery
    await random1Fresh.client.conversations.syncAll();
    await bob.client.conversations.syncAll();

    const testDm = await random1Fresh.client.conversations.newDm(
      bob.client.inboxId,
    );
    await testDm.send("Test message from random1's fresh client");

    const verifyResult = await verifyMessageStream(testDm as Conversation, [
      bob,
    ]);

    // Verify message delivery works after stitching
    expect(verifyResult.allReceived).toBe(true);
    expect(verifyResult.receptionPercentage).toBeGreaterThan(95);
  });
});
