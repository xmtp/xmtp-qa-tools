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
    void sendPerformanceMetric(start, testName, libXmtpVersion, false);
  });

  afterAll(async () => {
    await closeEnv(testName, workers);
  });
};
