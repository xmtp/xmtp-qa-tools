import "@helpers/datadog";
import { verifyMessageStream } from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Dm } from "version-management/client-versions";
import { describe, expect, it } from "vitest";

const testName = "performance";
describe(testName, () => {
  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };
  setupDurationTracking({
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
    initDataDog: true,
    sendDurationMetrics: true,
    networkStats: true,
  });

  let workers: WorkerManager;
  let creator: Worker | undefined;
  let receiver: Worker | undefined;
  let dm: Dm | undefined;
  it(`create: measure creating a client`, async () => {
    workers = await getWorkers(5);
    creator = workers.getCreator();
    receiver = workers.getReceiver();
    setCustomDuration(creator.initializationTime);
  });
  it(`newDm:measure creating a DM`, async () => {
    dm = (await creator!.client.conversations.newDm(
      receiver!.client.inboxId,
    )) as Dm;
    expect(dm).toBeDefined();
    expect(dm.id).toBeDefined();
  });
  it(`send:measure sending a gm`, async () => {
    const dmId = await dm!.send("gm");
    expect(dmId).toBeDefined();
  });
  it(`streamMessage:measure receiving a gm`, async () => {
    const verifyResult = await verifyMessageStream(dm!, [receiver!]);
    setCustomDuration(verifyResult.averageEventTiming);
    expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(99);
  });
  it(`send:measure sending a gm`, async () => {
    const dmId = await dm!.send("gm");
    expect(dmId).toBeDefined();
  });

  it(`streamMessage:measure receiving a gm`, async () => {
    const verifyResult = await verifyMessageStream(dm!, [receiver!]);
    setCustomDuration(verifyResult.averageEventTiming);
    expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(99);
  });
});
