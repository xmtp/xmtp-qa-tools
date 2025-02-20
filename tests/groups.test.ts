import type { XmtpEnv } from "node-sdk-42";
import { timeout } from "puppeteer-core";
import { beforeAll, describe, it } from "vitest";
import { createLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  getNewRandomPersona,
  getPersonas,
  type Persona,
} from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TC_Groups_" + env + ":";
const logger = createLogger(testName);
overrideConsole(logger);

describe("Performance test for sending gm, creating group, and sending gm in group", () => {
  let bob: Persona,
    alice: Persona,
    joe: Persona,
    bobB41: Persona,
    dmId: string,
    groupId: string,
    randomAddress: string,
    randomInboxId: string;

  beforeAll(async () => {
    [bob, alice, joe, bobB41] = await getPersonas(
      ["bob", "alice", "joe", "bobB41"],
      env,
      testName,
    );
  }, defaultValues.timeout);

  it(
    "should measure creating a group and sending a gm in it catched up by 2 streams",
    async () => {
      groupId = await bob.worker!.createGroup([
        joe.address!,
        bob.address!,
        alice.address!,
      ]);
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      const alicePromise = alice.worker!.receiveMessage(groupId!, groupMessage);
      const joePromise = joe.worker!.receiveMessage(groupId!, groupMessage);

      await bob.worker!.sendMessage(
        "65ca5432d914386f662f1f76d73159ff",
        groupMessage,
      );
      await Promise.all([joePromise, alicePromise]);
    },
    defaultValues.timeout,
  );

});
