import type { XmtpEnv } from "node-sdk-42";
import { beforeAll, describe, it } from "vitest";
import { testLogger } from "../helpers/logger";
import {
  defaultValues,
  getNewRandomPersona,
  getPersonas,
  type Persona,
} from "../helpers/personas";

const env: XmtpEnv = "dev";
const logger = testLogger.createTest("Performance test " + env);

describe("Performance test for sending gm, creating group, and sending gm in group", () => {
  let bob: Persona,
    alice: Persona,
    joe: Persona,
    bobB41: Persona,
    dmId: string,
    groupId: string,
    randomPersona: string;

  beforeAll(async () => {
    [bob, alice, joe, bobB41] = await getPersonas(
      ["bob", "alice", "joe", "bobB41"],
      env,
      logger,
    );
    randomPersona = await getNewRandomPersona(env);
  }, defaultValues.timeout);

  it(
    "should measure creating a group",
    async () => {
      console.time("createGroupTime");
      groupId = await bob.worker!.createGroup([
        joe.address!,
        bob.address!,
        alice.address!,
      ]);
      console.timeEnd("createGroupTime");

      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      const alicePromise = alice.worker!.receiveMessage(groupId!, groupMessage);
      const joePromise = joe.worker!.receiveMessage(groupId!, groupMessage);

      console.time("streamCatchTime");
      await bob.worker!.sendMessage(groupId!, groupMessage);
      await Promise.all([joePromise]);
      console.timeEnd("streamCatchTime");
    },
    defaultValues.timeout,
  );
});
