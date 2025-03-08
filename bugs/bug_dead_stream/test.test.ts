import { closeEnv, loadEnv } from "@helpers/client";
import { redeployDeployment } from "@helpers/railway";
import { type Conversation, type Persona } from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "bug_dead_stream";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation;
  let personas: Record<string, Persona>;
  const gmBotAddress = process.env.GM_BOT_ADDRESS as string;
  let streamAlive = false;

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
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if we got a response
    const messagesAfter = (await convo.messages()).length;

    streamAlive = messagesAfter === prevMessages + 2;
    console.log("Messages before:", prevMessages, "after:", messagesAfter);
    expect(streamAlive).toBe(true);
  });

  it("gm-bot: should restart if stream is not alive", async () => {
    if (!streamAlive) {
      console.log("Stream is not alive, redeploying...");
      await redeployDeployment(process.env.GM_BOT_ADDRESS as string);
      streamAlive = true;
    }
  });
});
