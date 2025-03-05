import { closeEnv, loadEnv } from "@helpers/client";
import { sendPerformanceMetric } from "@helpers/datadog";
import { type Persona } from "@helpers/types";
import { verifyConversationStream } from "@helpers/verify";
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

const testName = "conversations";
loadEnv(testName);

describe(testName, () => {
  let personas: Record<string, Persona>;
  let start: number;

  beforeAll(async () => {
    personas = await getWorkers(
      [
        "henry",
        "ivy",
        "jack",
        "karen",
        "randomguy",
        "larry",
        "mary",
        "nancy",
        "oscar",
      ],
      testName,
      "conversation",
    );
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
  it("detects new group conversation creation with three participants", async () => {
    const sender = personas.henry;
    const participants = [personas.nancy, personas.oscar];

    await verifyConversationStream(sender, participants);
  });

  it("detects new group conversation with all available personas", async () => {
    const sender = personas.henry;
    const participants = [
      personas.nancy,
      personas.oscar,
      personas.jack,
      personas.ivy,
    ];

    await verifyConversationStream(sender, participants);
  });
});
