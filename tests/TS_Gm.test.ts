import { closeEnv, loadEnv } from "@helpers/client";
import { type Conversation, type Persona } from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testGmBot } from "../playwright/gm-bot.playwright";

const testName = "ts_gm";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation;
  let personas: Record<string, Persona>;
  const gmBotAddress = process.env.GM_BOT_ADDRESS as string;

  beforeAll(async () => {
    personas = await getWorkers(["bob"], testName);
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  it("gm-bot: should check if bot is alive", async () => {
    // Create conversation with the bot
    convo = await personas.bob.client!.conversations.newDm(gmBotAddress);
    const prevMessages = (await convo.messages()).length;

    // Send a simple message
    await convo.send("gm");

    // Wait briefly for response
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if we got a response
    const messagesAfter = (await convo.messages()).length;

    // We should have at least 2 messages (our message and bot's response)
    expect(messagesAfter).toBe(prevMessages + 2);
    console.log("Messages before:", prevMessages, "after:", messagesAfter);
  });

  it("should respond to a message", async () => {
    console.time("respond-to-message-test");
    const result = await testGmBot(gmBotAddress);
    expect(result).toBe(true);
    console.timeEnd("respond-to-message-test");
  });
});
