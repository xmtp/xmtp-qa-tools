import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  type ExpectStatic,
} from "vitest";
import { loadEnv } from "./client";
import { flushMetrics, sendPerformanceMetric } from "./datadog";

export const setupTestLifecycle = ({
  testName,
  expect,
  getCustomDuration,
  setCustomDuration,
}: {
  testName: string;
  expect: ExpectStatic;
  getCustomDuration?: () => number | undefined;
  setCustomDuration?: (v: number | undefined) => void;
}) => {
  beforeAll(() => {
    loadEnv(testName);
  });
  let start: number;
  beforeEach(() => {
    start = performance.now();
    const currentTestName = expect.getState().currentTestName;
    console.time(currentTestName);
    if (setCustomDuration) setCustomDuration(undefined); // Reset before each test if available
  });

  afterEach(function () {
    const testName = expect.getState().currentTestName ?? "";
    let duration = performance.now() - start;
    if (getCustomDuration) {
      const customDuration = getCustomDuration();
      if (typeof customDuration === "number") {
        duration = customDuration;
      }
    }
    void sendPerformanceMetric(duration, testName);
    if (setCustomDuration) setCustomDuration(undefined); // Reset after each test if available
  });

  afterAll(async () => {
    await flushMetrics();
  });
};
