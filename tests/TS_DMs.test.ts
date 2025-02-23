import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { verifyDM, type XmtpEnv } from "../helpers/verify";
import {
  defaultValues,
  getWorkers,
  type Persona,
} from "../helpers/workers/creator";

const env: XmtpEnv = "dev";
const testName = "TS_DMs_" + env;

describe(testName, () => {
  let bob: Persona;
  let joe: Persona;
  let sam: Persona;
  let personas: Persona[];

  beforeAll(async () => {
    const logger = createLogger(testName);
    overrideConsole(logger);
    personas = await getWorkers(["bob", "joe", "sam"], env, testName);
    [bob, joe, sam] = personas;
    console.log("bob", bob.client?.accountAddress);
    console.log("joe", joe.client?.accountAddress);
    console.log("sam", sam.client?.accountAddress);
    // Add delay to ensure streams are properly initialized
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, defaultValues.timeout);

  afterAll(async () => {
    flushLogger(testName);
    await Promise.all(
      personas.map(async (persona) => {
        await persona.worker?.terminate();
      }),
    );
  });

  it(
    "TC_CreateDM: should measure creating a DM",
    async () => {
      const conversation = await bob.client!.conversations.newDm(
        sam.client!.accountAddress,
      );
      expect(conversation).toBeDefined();
      expect(conversation.id).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "TC_SendGM: should measure sending a gm",
    async () => {
      // We'll expect this random message to appear in Joe's stream
      const message = "gm-" + Math.random().toString(36).substring(2, 15);

      console.log(
        `[${bob.name}] Creating DM with ${sam.name} at ${sam.client?.accountAddress}`,
      );

      const dmConvo = await bob.client?.conversations.newDm(
        sam.client?.accountAddress as `0x${string}`,
      );
      const dmId = await dmConvo?.send(message);

      expect(dmId).toBeDefined();
    },
    defaultValues.timeout,
  );

  it(
    "TC_ReceiveGM: should measure receiving a gm",
    async () => {
      const dmConvo = await bob.client?.conversations.newDm(
        sam.client?.accountAddress as `0x${string}`,
      );
      if (!dmConvo) {
        throw new Error("DM conversation not found");
      }
      const message = "gm-" + Math.random().toString(36).substring(2, 15);
      const result = await verifyDM(() => dmConvo.send(message), [sam]);
      expect(result).toEqual([message]);
    },
    defaultValues.timeout,
  ); // Increase timeout if needed

  afterAll(async () => {
    flushLogger(testName);
  });
});
