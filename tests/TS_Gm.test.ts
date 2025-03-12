import { closeEnv, loadEnv } from "@helpers/client";
import { sendTestResults } from "@helpers/datadog";
import { logError } from "@helpers/tests";
import {
  IdentifierKind,
  type Conversation,
  type NestedPersonas,
} from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testGmBot } from "../playwright/gm-bot.playwright";

const testName = "ts_gm";
loadEnv(testName);

const gmBotAddress = process.env.GM_BOT_ADDRESS as string;
console.log(`[${testName}] GM Bot Address: ${gmBotAddress}`);

describe(testName, () => {
  let convo: Conversation;
  let personas: NestedPersonas;
  let hasFailures: boolean = false;

  beforeAll(async () => {
    try {
      personas = await getWorkers(["bob"], testName);
      expect(personas).toBeDefined();
      expect(personas.getPersonas().length).toBe(1);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  afterAll(async () => {
    try {
      sendTestResults(hasFailures ? "failure" : "success", testName);
      await closeEnv(testName, personas);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("gm-bot: should check if bot is alive", async () => {
    try {
      // Create conversation with the bot
      convo = await personas
        .get("bob")!
        .client.conversations.newDmByIdentifier({
          identifierKind: IdentifierKind.Ethereum,
          identifier: gmBotAddress,
        });

      await convo.sync();
      const prevMessages = (await convo.messages()).length;

      // Send a simple message
      await convo.send("gm");

      // Wait briefly for response
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const messages = await convo.messages();

      const messagesAfter = messages.length;

      // We should have at least 2 messages (our message and bot's response)
      expect(messagesAfter).toBe(prevMessages + 2);
      console.log("Messages before:", prevMessages, "after:", messagesAfter);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("should respond to a message", async () => {
    try {
      console.time("respond-to-message-test");
      const result = await testGmBot(gmBotAddress);
      expect(result).toBe(true);
      console.timeEnd("respond-to-message-test");
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });
});
