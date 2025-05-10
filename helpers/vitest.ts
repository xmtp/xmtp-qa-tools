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
}: {
  expect: ExpectStatic;
  workers: WorkerManager;
  testName: string;
  getStart: () => number;
  setStart: (v: number) => void;
}) => {
  beforeEach(() => {
    const currentTestName = expect.getState().currentTestName;
    console.time(currentTestName);
    setStart(performance.now());
  });

  afterEach(function () {
    const start = getStart();
    const testName = expect.getState().currentTestName ?? "";
    const libXmtpVersion = workers.getVersion();
    const duration = performance.now() - start;
    void sendPerformanceMetric(duration, testName, libXmtpVersion, false);
    setStart(0);
  });

  afterAll(async () => {
    await closeEnv(testName, workers);
  });
};
