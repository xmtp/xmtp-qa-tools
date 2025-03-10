import { sendPerformanceMetric } from "./datadog";
import type { Persona } from "./types";

export const logError = (e: any, expect: any): boolean => {
  console.error(
    `[vitest] Test failed in ${expect.getState().currentTestName}`,
    e,
  );
  if (e instanceof Error) {
    console.error(`Error details: ${e.message}`);
  } else {
    console.error(`Unknown error type:`, typeof e);
  }
  return true;
};

export const exportTestResults = (
  expect: any,
  personas: Record<string, Persona>,
  start: number,
) => {
  const testName = expect.getState().currentTestName;
  if (testName) {
    console.timeEnd(testName as string);
    expect(Object.values(personas)).toBeDefined();
    expect(Object.values(personas).length).toBeGreaterThan(0);
    void sendPerformanceMetric(
      performance.now() - start,
      testName as string,
      Object.values(personas)[0].version,
    );
  }
};
