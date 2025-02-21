import type { XmtpEnv } from "node-sdk-42";
import { beforeAll, describe, expect, it } from "vitest";
import { createLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  getNewRandomPersona,
  getPersonas,
  type Persona,
} from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TC_Performance_" + env + ":";
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
    const { address, inboxId } = await getNewRandomPersona(env);
    randomAddress = address;
    randomInboxId = inboxId;
  }, defaultValues.timeout);

  it(
    "should measure creating a DM",
    async () => {
      dmId = await bob.worker!.createDM(randomAddress);
    },
    defaultValues.timeout,
  );

  it(
    "should measure sending a gm",
    async () => {
      const gmMessage = "gm-" + Math.random().toString(36).substring(2, 15);
      await bob.worker!.sendMessage(dmId!, gmMessage);
    },
    defaultValues.timeout,
  );
  it(
    "should create a group and update group name",
    async () => {
      groupId = await bob.worker!.createGroup([
        joe.address!,
        bob.address!,
        alice.address!,
      ]);
      const newGroupName =
        "name-" + Math.random().toString(36).substring(2, 15);

      const joePromise = joe.worker!.receiveMetadata(groupId!, newGroupName);
      await bob.worker!.updateGroupName(groupId, newGroupName);
      const joeReceived = await joePromise;
      expect(joeReceived).toBe(newGroupName);
    },
    defaultValues.timeout,
  );
  it(
    "should measure creating a group",
    async () => {
      groupId = await bob.worker!.createGroup([
        joe.address!,
        bob.address!,
        alice.address!,
      ]);
    },
    defaultValues.timeout,
  );

  it(
    "should measure sending a gm in a group",
    async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      await bob.worker!.sendMessage(groupId!, groupMessage);
    },
    defaultValues.timeout,
  );
  it(
    "should measure 1 stream catching up a message in a group",
    async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      const joePromise = joe.worker!.receiveMessage(groupId!, groupMessage);

      await alice.worker!.sendMessage(groupId!, groupMessage);
      await Promise.all([joePromise]);
    },
    defaultValues.timeout,
  );
  it(
    "should create a group and measure 2 streams catching up a message in a group",
    async () => {
      groupId = await bob.worker!.createGroup([
        joe.address!,
        bob.address!,
        alice.address!,
      ]);
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      const alicePromise = alice.worker!.receiveMessage(groupId!, groupMessage);
      const joePromise = joe.worker!.receiveMessage(groupId!, groupMessage);

      await bob.worker!.sendMessage(groupId!, groupMessage);
      const [aliceReceived, joeReceived] = await Promise.all([
        alicePromise,
        joePromise,
      ]);
      expect(aliceReceived).toBe(groupMessage);
      expect(joeReceived).toBe(groupMessage);
    },
    defaultValues.timeout,
  );

  it(
    "should measure sending a gm from SDK 42 to 41",
    async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      const bob41Promise = bobB41.worker!.receiveMessage(
        groupId!,
        groupMessage,
      );
      const joePromise = joe.worker!.receiveMessage(groupId!, groupMessage);

      await alice.worker!.sendMessage(groupId!, groupMessage);
      const [joeReceived, bob41Received] = await Promise.all([
        joePromise,
        bob41Promise,
      ]);
      expect(joeReceived).toBe(groupMessage);
      expect(bob41Received).toBe(groupMessage);
    },
    defaultValues.timeout,
  );
});
