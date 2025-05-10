import type { WorkerManager } from "@workers/manager";
import { afterAll, afterEach, beforeEach, type ExpectStatic } from "vitest";
import { closeEnv } from "./client";
import { sendPerformanceResult } from "./datadog";

export const setupTestLifecycle = ({
  expect,
  workers,
  testName,
  getStart,
  getTestStart,
  setStart,
  setTestStart,
}: {
  expect: ExpectStatic;
  workers: WorkerManager;
  testName: string;
  getStart: () => number;
  setStart: (v: number) => void;
  getTestStart: () => number;
  setTestStart: (v: number) => void;
}) => {
  beforeEach(() => {
    const currentTestName = expect.getState().currentTestName;
    console.time(currentTestName);
    setTestStart(performance.now());
    setStart(performance.now());
  });

  afterEach(function () {
    sendPerformanceResult(
      expect.getState().currentTestName ?? "",
      workers.getVersion(),
      getStart(),
      getTestStart(),
    );
  });

  afterAll(async () => {
    await closeEnv(testName, workers);
  });
};
