import { type AgentManager } from "@agents/manager";
import { sendPerformanceMetric } from "./datadog";

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
  agents: AgentManager,
  start: number,
) => {
  const testName = expect.getState().currentTestName;
  if (testName) {
    console.timeEnd(testName as string);
    expect(agents.getAgents()).toBeDefined();
    expect(agents.getAgents().length).toBeGreaterThan(0);
    void sendPerformanceMetric(
      performance.now() - start,
      testName as string,
      agents.getVersion(),
    );
  }
};
export async function listInstallations(agents: AgentManager) {
  for (const agent of agents.getAgents()) {
    const inboxState = await agent.client?.inboxState();
    if (inboxState) {
      console.log(
        agent.name,
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
