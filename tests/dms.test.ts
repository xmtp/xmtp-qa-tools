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
import { verifyStream } from "../helpers/verify";
import { getWorkers } from "../helpers/workers/factory";

const testName = "dms";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation;
  let personas: Record<string, Persona>;
  let start: number;

  beforeAll(async () => {
    personas = await getWorkers(["bob", "joe", "sam", "random"], testName);
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
    convo = await personas.bob.client!.conversations.newDm(
      personas.random.client!.accountAddress,
    );

    expect(convo).toBeDefined();
    expect(convo.id).toBeDefined();
  });

  it("sendGM: should measure sending a gm", async () => {
    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    console.log(
      `[${personas.bob.name}] Creating DM with ${personas.random.name} at ${personas.random.client?.accountAddress}`,
    );

    const dmId = await convo.send(message);

    expect(dmId).toBeDefined();
  });

  it("receiveGM: should measure receiving a gm", async () => {
    const verifyResult = await verifyStream(convo, [personas.random]);

    expect(verifyResult.messages.length).toEqual(1);
    expect(verifyResult.allReceived).toBe(true);
  });
});
