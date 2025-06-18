import { getWorkersWithVersions } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Dm } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "versioned";

describe(testName, () => {
  let workers: WorkerManager;
  let convo: Dm;

  beforeAll(async () => {
    // Use getWorkersWithVersions to support CLI --versions parameter
    const workerDescriptors = getWorkersWithVersions([
      "alice",
      "bob",
      "charlie",
      "david",
    ]);

    console.log(
      `Creating workers with descriptors: ${workerDescriptors.join(", ")}`,
    );

    workers = await getWorkers(
      workerDescriptors,
      testName,
      typeofStream.Message,
    );
  });

  setupTestLifecycle({
    testName,
    expect,
  });

  it("should log worker versions for verification", async () => {
    try {
      const allWorkers = workers.getAll();
      for (const worker of allWorkers) {
        console.log(
          `Worker ${worker.name}: SDK version ${worker.sdkVersion}, libXMTP version ${worker.libXmtpVersion}`,
        );
      }
      expect(allWorkers.length).toBeGreaterThan(0);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should create a new DM conversation between versioned workers", async () => {
    try {
      convo = (await workers
        .get("alice")!
        .client.conversations.newDm(workers.get("bob")!.client.inboxId)) as Dm;

      expect(convo).toBeDefined();
      expect(convo.id).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should send and verify message delivery between versioned workers", async () => {
    try {
      const message =
        "versioned-test-" + Math.random().toString(36).substring(2, 15);

      console.log(
        `[${workers.get("alice")?.name}] (v${workers.get("alice")?.sdkVersion}) sending to [${workers.get("bob")?.name}] (v${workers.get("bob")?.sdkVersion})`,
      );

      await convo.send(message);

      const verifyResult = await verifyMessageStream(convo, [
        workers.get("bob")!,
      ]);

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should test group conversation with mixed versions", async () => {
    try {
      const group = await workers.createGroup("Mixed Version Test Group");
      expect(group.id).toBeDefined();

      const message =
        "group-test-" + Math.random().toString(36).substring(2, 15);
      await group.send(message);

      const verifyResult = await verifyMessageStream(
        group,
        workers.getAllButCreator(),
      );
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
