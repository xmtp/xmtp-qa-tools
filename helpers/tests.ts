import { sendPerformanceMetric } from "./datadog";
import { type WorkerManager } from "./types";

export const logError = (e: any, expect: any): boolean => {
  if (e instanceof Error) {
    console.error(
      `[vitest] Test failed in ${expect.getState().currentTestName}`,
      e.message,
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
  personas: WorkerManager,
  start: number,
) => {
  const testName = expect.getState().currentTestName;
  if (testName) {
    console.timeEnd(testName as string);
    expect(personas.getWorkers()).toBeDefined();
    expect(personas.getWorkers().length).toBeGreaterThan(0);
    void sendPerformanceMetric(
      performance.now() - start,
      testName as string,
      personas.getVersion(),
    );
  }
};
export async function listInstallations(personas: WorkerManager) {
  for (const persona of personas.getWorkers()) {
    const inboxState = await persona.client?.inboxState();
    if (inboxState) {
      console.log(
        persona.name,
        "has",
        inboxState.installations.length,
        "installations",
      );
      //for (const installation of inboxState.installations) {
      // console.debug(
      //   persona.name +
      //     "(" +
      //     String(inboxState.installations.length) +
      //     ")" +
      //     installation.id,
      // );
      //}
    }
  }
}
