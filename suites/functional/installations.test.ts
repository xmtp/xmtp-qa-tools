import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "installations";

describe(testName, () => {
  setupTestLifecycle({ testName });

  it("shared identity and separate storage", async () => {
    const baseName = "randomguy";

    // Create primary installation
    const primary = await getWorkers([baseName]);

    // Create secondary installation with different folder
    const secondary = await getWorkers([baseName + "-desktop"]);

    // Get workers with correct base name and installation IDs
    const primaryWorker = primary.get(baseName);
    const secondaryWorker = secondary.get(baseName, "desktop");

    // Ensure workers exist
    expect(primaryWorker).toBeDefined();
    expect(secondaryWorker).toBeDefined();

    // shared identity but separate storage
    expect(primaryWorker?.client.inboxId).toBe(secondaryWorker?.client.inboxId);
    expect(primaryWorker?.dbPath).not.toBe(secondaryWorker?.dbPath);
  });
});
