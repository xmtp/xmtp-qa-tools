import fs from "fs";
import { closeEnv, loadEnv } from "@helpers/client";
import { sendPerformanceMetric } from "@helpers/datadog";
import { type Conversation, type Persona } from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { testGmBot } from "../playwright/gm-bot.playwright";

const gmBotAddress = process.env.GM_BOT_ADDRESS as string;
const testName = "TS_Gm";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation;
  let personas: Record<string, Persona>;
  let start: number;

  beforeAll(async () => {
    console.time("beforeAll");
    fs.rmSync(".data", { recursive: true, force: true });
    personas = await getWorkers(["bob"], testName);
    console.timeEnd("beforeAll");
  });

  beforeEach(() => {
    const testName = expect.getState().currentTestName;
    start = performance.now();
    console.time(testName);
  });

  afterAll(async () => {
    console.time("afterAll");
    await closeEnv(testName, personas);
    console.timeEnd("afterAll");
  });

  afterEach(function () {
    const testName = expect.getState().currentTestName;
    console.timeEnd(testName);
    if (testName) {
      void sendPerformanceMetric(
        performance.now() - start,
        testName,
        Object.values(personas)[0].version,
      );
    }
  });

  it("gm-bot: should measure sending a gm", async () => {
    console.time("gm-bot-test");

    console.time("create-conversation");
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
    await new Promise((resolve) => setTimeout(resolve, 2000));
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
