import fs from "fs";
import { sendPerformanceMetric } from "./datadog";
import type { Persona } from "./types";

export const logError = (e: any, expect: any): boolean => {
  if (e instanceof Error) {
    console.error(
      `[vitest] Test failed in ${expect.getState().currentTestName}`,
      e,
    );
  } else {
    console.error(`Unknown error type:`, typeof e);
  }
  return true;
};
// export const removeDB = (fileName: string) => {
//   const testFilePath = fileName.split("/").slice(0, -1).join("/") + "/";
//   console.log("testFilePath", fileName, testFilePath);
//   fs.rmSync(".data", { recursive: true, force: true });
// };
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
export async function listInstallations(personas: Record<string, Persona>) {
  for (const persona of Object.values(personas)) {
    const inboxState = await persona.client?.inboxState();
    if (inboxState) {
      console.log(
        persona.name,
        " has ",
        inboxState.installations.length,
        " installations",
      );
      for (const installation of inboxState.installations) {
        // console.debug(
        //   persona.name +
        //     "(" +
        //     String(inboxState.installations.length) +
        //     ")" +
        //     installation.id,
        // );
      }
    }
  }
}
