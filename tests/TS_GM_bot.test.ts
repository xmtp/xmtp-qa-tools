import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { closeEnv, loadEnv } from "../helpers/client";
import { sendMetric } from "../helpers/datadog";
import { type Conversation, type Persona } from "../helpers/types";
import { getWorkers } from "../helpers/workers/factory";

const gmBotAddress = "0x3237451eb4b3Cd648fdcD9c7818C9B64b60e82fA";
const testName = "dms";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation;
  let personas: Record<string, Persona>;
  let start: number;

  beforeAll(async () => {
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
      void sendMetric(performance.now() - start, testName, personas);
    }
  });

  it("createDM: should measure creating a DM", async () => {
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
});
