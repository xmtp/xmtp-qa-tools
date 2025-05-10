import type { WorkerManager } from "@workers/manager";
import { afterAll, afterEach, beforeEach, type ExpectStatic } from "vitest";
import { closeEnv } from "./client";
import { sendPerformanceMetric } from "./datadog";

export const setupTestLifecycle = ({
  expect,
  workers,
  testName,
  getStart,
  setStart,
  getCustomDuration,
  setCustomDuration,
}: {
  expect: ExpectStatic;
  workers: WorkerManager;
  testName: string;
  getStart: () => number;
  setStart: (v: number) => void;
  getCustomDuration?: () => number | undefined;
  setCustomDuration?: (v: number | undefined) => void;
}) => {
  beforeEach(() => {
    const currentTestName = expect.getState().currentTestName;
    console.time(currentTestName);
    setStart(performance.now());
    if (setCustomDuration) setCustomDuration(undefined); // Reset before each test if available
  });

  afterEach(function () {
    const start = getStart();
    const testName = expect.getState().currentTestName ?? "";
    const libXmtpVersion = workers.getVersion();
    let duration = performance.now() - start;
    if (getCustomDuration) {
      const customDuration = getCustomDuration();
      if (typeof customDuration === "number") {
        duration = customDuration;
      }
    }
    void sendPerformanceMetric(duration, testName, libXmtpVersion, false);
    if (setCustomDuration) setCustomDuration(undefined); // Reset after each test if available
  });

  afterAll(async () => {
    await closeEnv(testName, workers);
  });
};
