import type { XmtpEnv } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { defaultValues, getPersonas, type Persona } from "../helpers/personas";
import { sendMessageTo } from "../helpers/testing";

const env: XmtpEnv = "dev";
const testName = "TS_DMs_" + env;
const logger = createLogger(testName);
overrideConsole(logger);

describe(testName, () => {
  let bob: Persona, joe: Persona, sam: Persona;

  beforeAll(async () => {
    [bob, joe, sam] = await getPersonas(["bob", "joe", "sam"], env, testName);
    console.log("bob", bob.client?.accountAddress);
    console.log("joe", joe.client?.accountAddress);
    console.log("sam", sam.client?.accountAddress);
    // Add delay to ensure streams are properly initialized
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, defaultValues.timeout);

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

  /* 
  TODO:
    - Why here the stream doest work? */
  it(
    "TC_ReceiveGM: should measure receiving a gm",
    async () => {
      const result = await sendMessageTo(bob, sam);
      expect(result).toBe(true);
    },
    defaultValues.timeout,
  ); // Increase timeout if needed

  afterAll(async () => {
    flushLogger(testName);
  });
});
