import type { WorkerManager } from "@workers/manager";
import { afterAll, afterEach, beforeEach, type ExpectStatic } from "vitest";
import { closeEnv } from "./client";
import { sendPerformanceResult, sendTestResults } from "./datadog";
import { logError } from "./logger";

export const setupTestLifecycle = ({
  expect,
  workers,
  testName,
  hasFailuresRef,
  getStart,
  getTestStart,
  setStart,
  setTestStart,
}: {
  expect: ExpectStatic;
  workers: WorkerManager;
  testName: string;
  hasFailuresRef: boolean;
  getStart: () => number;
  setStart: (v: number) => void;
  getTestStart: () => number;
  setTestStart: (v: number) => void;
}) => {
  beforeEach(() => {
    const currentTestName = expect.getState().currentTestName;
    console.time(currentTestName);
    getTestStart();
    getStart();
  });

  afterEach(function () {
    console.log("After each");
    try {
      sendPerformanceResult(
        expect.getState().currentTestName ?? "",
        workers,
        getStart(),
        getTestStart(),
      );
    } catch (e) {
      hasFailuresRef = logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  afterAll(async () => {
    console.log("After all");
    try {
      sendTestResults(hasFailuresRef, testName);
      await closeEnv(testName, workers);
    } catch (e) {
      hasFailuresRef = logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
};
