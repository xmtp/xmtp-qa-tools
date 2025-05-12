import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyConsentStream } from "@helpers/streams";
import { getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "consent";
loadEnv(testName);

describe(testName, async () => {
  let workers: WorkerManager;

  workers = await getWorkers(getRandomNames(5), testName, typeofStream.Consent);

  setupTestLifecycle({
    expect,
    workers,
    testName,
  });

  it("should stream consent updates when a user is blocked", async () => {
    try {
      const verifyResult = await verifyConsentStream(
        workers.getCreator(),
        workers.getReceiver(),
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
