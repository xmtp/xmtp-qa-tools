import fs from "fs";
import { closeEnv, loadEnv } from "@helpers/client";
import {
  type Conversation,
  type Installation,
  type Persona,
} from "@helpers/types";
import { countInstallations } from "@helpers/verify";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "panic_bug_account";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation | null;
  const installations: Installation[] = [];
  let personas: Record<string, Persona>;

  beforeAll(async () => {
    // const testFilePath = __filename.split("/").slice(0, -1).join("/") + "/";
    // fs.rmSync(testFilePath + ".data", { recursive: true, force: true });

    personas = await getWorkers(["henry", "ivy", "bug", "bug-b"], testName);
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });
  it("inboxState", async () => {
    const inboxState = await personas.bug.client!.inboxState(true);
    console.log("Installations", inboxState.installations.length);
    const inboxState2 = await personas["bug-b"].client!.inboxState(true);
    console.log("Installations", inboxState2.installations.length);
  });

  it("new dm with bug", async () => {
    convo = await personas.henry.client!.conversations.newDm(
      personas["bug-b"].client!.accountAddress,
    );
    expect(convo.id).toBeDefined();
    console.log("convo", convo.id);
  });

  it("should count conversations", async () => {
    await convo?.send("hello");
    await personas.bug.client?.conversations.sync();
    const listConversations = personas.bug.client?.conversations.list();
    console.log(listConversations?.length);
    expect(listConversations?.length).toBe(1);
    await convo?.send("hello");
    await personas["bug-b"].client?.conversations.sync();
    const listConversations2 = personas["bug-b"].client?.conversations.list();
    console.log(listConversations2?.length);
    expect(listConversations2?.length).toBe(1);
  });

  it("should count conversations", async () => {
    await convo?.send("hello");
    await personas.bug.client?.conversations.sync();
    const listConversations =
      personas.bug.client?.conversations.getConversationById(convo?.id);
    console.log(listConversations?.messages.length);
    expect(listConversations?.messages.length).toBe(1);
    await convo?.send("hello");
    const listConversations2 = personas[
      "bug-b"
    ].client?.conversations.getConversationById(convo?.id);
    console.log(listConversations2?.messages.length);
    expect(listConversations2?.messages.length).toBe(1);
  });
});
