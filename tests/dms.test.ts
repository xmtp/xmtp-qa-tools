import { closeEnv, loadEnv } from "@helpers/client";
import { type Conversation, type Persona } from "@helpers/types";
import { verifyStream } from "@helpers/verify";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "dms";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation;
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
    );
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  it("createDM: should measure creating a DM", async () => {
    convo = await personas.henry.client!.conversations.newDm(
      personas.randomguy.client!.accountAddress,
    );

    expect(convo).toBeDefined();
    expect(convo.id).toBeDefined();
  });

  it("sendGM: should measure sending a gm", async () => {
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    console.log(
      `[${personas.henry.name}] Creating DM with ${personas.randomguy.name} at ${personas.randomguy.client?.accountAddress}`,
    );

    const dmId = await convo.send(message);

    expect(dmId).toBeDefined();
  });

  it("receiveGM: should measure receiving a gm", async () => {
    const verifyResult = await verifyStream(convo, [personas.randomguy]);

    expect(verifyResult.messages.length).toEqual(1);
    expect(verifyResult.allReceived).toBe(true);
  });
});
