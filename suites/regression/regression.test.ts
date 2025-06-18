import { defaultNames, sdkVersionOptions } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "regression";

describe(testName, () => {
  let workers: WorkerManager;
  const versions = sdkVersionOptions.reverse().slice(0, 3);
  let cantWorkers = 6;
  let cantRetries = 5;
  let group: Group | undefined = undefined;

  for (let i = 0; i < cantRetries; i++) {
    let names = defaultNames.slice(0, cantWorkers - 1);
    const ArrayofVersionsRandom = versions.sort(() => Math.random() - 0.5);
    let allNames = names.map(
      (name, index) =>
        name +
        "-a-" +
        ArrayofVersionsRandom[index % ArrayofVersionsRandom.length],
    );
    it(
      "should create group conversation with versions " +
        ArrayofVersionsRandom.join(", "),
      async () => {
        try {
          console.warn("allNames", allNames);
          workers = await getWorkers(allNames, testName, typeofStream.Message);

          if (!group) {
            group = await workers.createGroup();
          }

          const members = await group?.members();
          console.log(
            "Group created with id",
            group?.id,
            "and members",
            members?.length,
          );
          const verifyResult = await verifyMessageStream(
            group,
            workers.getAllButCreator(),
          );
          expect(verifyResult.allReceived).toBe(true);
        } catch (e) {
          logError(e, expect.getState().currentTestName);
          throw e;
        }
      },
    );
  }
});
