import { closeEnv, loadEnv } from "@helpers/client";
import { type Persona } from "@helpers/types";
import { verifyConversationStream } from "@helpers/verify";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, it } from "vitest";

const testName = "conversations";
loadEnv(testName);

describe(testName, () => {
  let personas: Record<string, Persona>;

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

  afterAll(async () => {
    await closeEnv(testName, personas);
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
