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

  it("gm-bot: should measure sending a gm", async () => {
    console.time("gm-bot-test");

    console.time("create-conversation");
    console.log("Creating conversation with gmBotAddress", gmBotAddress);
    convo = await personas.bob.client!.conversations.newDm(gmBotAddress);
    console.timeEnd("create-conversation");

    console.time("sync-conversation");
    await convo.sync();
    console.timeEnd("sync-conversation");

    console.time("get-messages");
    const messages = await convo.messages();
    console.timeEnd("get-messages");

    console.log("Messages before sending", messages.length);
    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    console.time("send-message");
    const dmId = await convo.send(message);
    console.timeEnd("send-message");

    console.time("wait-for-response");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.timeEnd("wait-for-response");

    console.time("get-messages-after");
    const messagesAfter = await convo.messages();
    console.timeEnd("get-messages-after");

    expect(messagesAfter.length).toBe(messages.length + 2);
    console.log("Messages after sending", messagesAfter.length);

    expect(dmId).toBeDefined();
    console.timeEnd("gm-bot-test");
  });

  it("should respond to a message", async () => {
    console.time("respond-to-message-test");
    const result = await testGmBot(gmBotAddress);
    expect(result).toBe(true);
    console.timeEnd("respond-to-message-test");
  });
});
