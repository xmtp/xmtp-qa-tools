import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../../helpers/client";
import {
  createLogger,
  flushLogger,
  overrideConsole,
} from "../../helpers/logger";
import {
  type Conversation,
  type Persona,
  type XmtpEnv,
} from "../../helpers/types";
import { getWorkers } from "../../helpers/workers/factory";

const env: XmtpEnv = "dev";
const testName = "panic_bug_account_" + env;
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation;
  let personas: Record<string, Persona>;

  beforeAll(async () => {
    fs.rmSync(".data", { recursive: true, force: true }); // TODO: remove this
    const logger = await createLogger(testName);
    overrideConsole(logger);

    personas = await getWorkers(["bob", "bug", "sam"], env, testName);
    console.log("bob", personas.bob.client?.accountAddress);
    console.log("bug", personas.bug.client?.accountAddress);
    console.log("sam", personas.sam.client?.accountAddress);
  });

  afterAll(async () => {
    await flushLogger(testName);
    await Promise.all(
      Object.values(personas).map(async (persona) => {
        await persona.worker?.terminate();
      }),
    );
  });

  it("TC_CreateDM: should measure creating a DM and sending a gm to bug", async () => {
    const creator = personas.bob;
    // switch to bug or sam
    const destination = personas.bug;

    convo = await creator.client!.conversations.newDm(
      destination.client!.accountAddress,
    );
    expect(convo).toBeDefined();
    expect(convo.id).toBeDefined();
    console.log("convo", convo.id);

    const message = "gm-" + Math.random().toString(36).substring(2, 15);
    await convo.send(message);
    await convo.sync();

    console.log(
      `[${creator.name}] Creating DM with ${destination.name} at ${destination.client?.accountAddress}`,
    );

    await destination.client?.conversations.syncAll();
    const conversations = destination.client?.conversations.list();
    console.log("conversations", conversations?.length);
    const bugConvo = conversations?.find(
      (c) => c.id === convo.id,
    ) as Conversation;
    console.log("bugConvo", bugConvo.id);
    await bugConvo.sync();
    console.log("bugConvo", bugConvo.id);
    expect(bugConvo.id).toBe(convo.id);
    const messagesfrombug = await bugConvo.messages();
    console.log("messagesfrombug", messagesfrombug);
    expect(messagesfrombug).toBeDefined();
    expect(messagesfrombug.length).toBeGreaterThan(0);
  });

  // it("TC_ReceiveGM: should measure receiving a gm", async () => {
  //   const gmMessageGenerator = async (i: number, suffix: string) => {
  //     return `gm-${i + 1}-${suffix}`;
  //   };

  //   const gmSender = async (convo: Conversation, message: string) => {
  //     await convo.send(message);
  //   };

  //   const verifyResult = await verifyStream(
  //     convo,
  //     [personas.bug],
  //     gmMessageGenerator,
  //     gmSender,
  //   );
  //   expect(verifyResult.messages.length).toEqual(1);
  //   expect(verifyResult.allReceived).toBe(true);
  // });
});
