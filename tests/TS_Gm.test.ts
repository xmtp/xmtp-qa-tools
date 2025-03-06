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

const gmBotAddress = "0x3237451eb4b3Cd648fdcD9c7818C9B64b60e82fA";
const testName = "TS_Gm";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation;
  let personas: Record<string, Persona>;
  let start: number;

  beforeAll(async () => {
    fs.rmSync(".data", { recursive: true, force: true });
    personas = await getWorkers(["bob"], testName);
  });

  beforeEach(() => {
    const testName = expect.getState().currentTestName;
    start = performance.now();
    console.time(testName);
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
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
    convo = await personas.bob.client!.conversations.newDm(gmBotAddress);
    await convo.sync();
    const messages = await convo.messages();
    console.log("Messages before sending", messages.length);
    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    const dmId = await convo.send(message);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    const messagesAfter = await convo.messages();
    expect(messagesAfter.length).toBe(messages.length + 2);
    console.log("Messages after sending", messagesAfter.length);

    expect(dmId).toBeDefined();
  });

  // it("should respond to a message", async () => {
  //   const result = await testGmBot(gmBotAddress);
  //   expect(result).toBe(true);
  // });
});
