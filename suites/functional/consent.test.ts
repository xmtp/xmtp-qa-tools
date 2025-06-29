import { getFixedNames, getWorkersWithVersions } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyConsentStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "consent";

describe(testName, async () => {
  let workers: WorkerManager;

  workers = await getWorkers(
    getWorkersWithVersions(getFixedNames(5)),
    testName,
    typeofStream.Consent,
  );

  setupTestLifecycle({
    testName,
    expect,
  });

  it("should stream consent state changes when users are blocked or unblocked", async () => {
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
