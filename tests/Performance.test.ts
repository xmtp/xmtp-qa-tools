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
    "should measure creating a DM",
    async () => {
      console.time("createDMTime");
      dmId = await bob.worker!.createDM(randomPersona);
      console.timeEnd("createDMTime");
    },
    defaultValues.timeout,
  );

  it(
    "should measure sending a gm",
    async () => {
      const gmMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      console.time("sendGmTime");
      await bob.worker!.sendMessage(dmId!, gmMessage);
      console.timeEnd("sendGmTime");
    },
    defaultValues.timeout,
  );

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
    },
    defaultValues.timeout,
  );

  it(
    "should measure sending a gm in a group",
    async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      console.time("sendGmInGroupTime");
      await bob.worker!.sendMessage(groupId!, groupMessage);
      console.timeEnd("sendGmInGroupTime");
    },
    defaultValues.timeout,
  );

  it(
    "should measure 2 streams catching up a message in a group",
    async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      const alicePromise = alice.worker!.receiveMessage(groupId!, groupMessage);
      const joePromise = joe.worker!.receiveMessage(groupId!, groupMessage);

      console.time("streamCatchTime");
      await bob.worker!.sendMessage(groupId!, groupMessage);
      await Promise.all([alicePromise, joePromise]);
      console.timeEnd("streamCatchTime");
    },
    defaultValues.timeout,
  );

  /* Returns a bug in the SDK, so we're disabling it for now*/
  // it(
  //   "should measure sending a gm from SDK 42 to 41",
  //   async () => {
  //     const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

  //     const bob41Promise = bobB41.worker!.receiveMessage(
  //       groupId!,
  //       groupMessage,
  //     );
  //     const joePromise = joe.worker!.receiveMessage(groupId!, groupMessage);

  //     console.time("streamCatchTime");
  //     await alice.worker!.sendMessage(groupId!, groupMessage);
  //     await Promise.all([bob41Promise, joePromise]);
  //     console.timeEnd("streamCatchTime");
  //   },
  //   defaultValues.timeout,
  // );
});
