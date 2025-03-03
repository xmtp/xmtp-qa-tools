import fs from "fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeEnv, loadEnv } from "../../helpers/client";
import {
  type Client,
  type Conversation,
  type Persona,
} from "../../helpers/types";
import { getInstallations, getWorkers } from "../../helpers/workers/factory";

const testName = "panic_bug_account";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation;
  let findBugConvo: Conversation;
  let group: Conversation;
  let personas: Record<string, Persona>;

  beforeAll(async () => {
    // const testFilePath = __filename.split("/").slice(0, -1).join("/") + "/";
    // fs.rmSync(testFilePath + ".data", { recursive: true, force: true });

    personas = await getWorkers(["bug", "bob"], testName);
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });
  it("should count my installations", async () => {
    let installations: Set<string> = new Set();
    for (const persona of Object.values(personas)) {
      await persona.client?.conversations.syncAll();
      installations = await getInstallations(persona.client as Client);
      console.log(`${persona.name} has ${installations.size} installations`);
    }
  });

  it("new dm with bug", async () => {
    convo = await personas.bob.client!.conversations.newDm(
      personas.bug.client!.accountAddress,
    );
    expect(convo.id).toBeDefined();
    console.log("convo", convo.id);
  });
  it("sync all", async () => {
    await personas.bug.client?.conversations.syncAll();
    findBugConvo = personas.bug.client?.conversations.getConversationById(
      convo.id,
    ) as Conversation;
    console.log("findBugConvo", findBugConvo.id);
    expect(findBugConvo.id).toBeDefined();
  });
  it("send message", async () => {
    await convo.send("Hello");
    await findBugConvo.send("Hello");
  });
  it("sync all", async () => {
    await personas.bug.client?.conversations.syncAll();
    await personas.bob.client?.conversations.syncAll();
  });
  it("fetch  messages", async () => {
    await convo.sync();
    const messages = await convo.messages();
    for (const message of messages) {
      console.log("message", message.content);
    }
    await findBugConvo.sync();
    const messages2 = await findBugConvo.messages();
    for (const message of messages2) {
      console.log("message", message.content);
    }
    expect(messages.length - 1).toBe(messages2.length);
  });
  it("crete new group", async () => {
    group = await personas.bug.client!.conversations.newGroup([
      personas.bob.client!.accountAddress,
    ]);
    expect(group.id).toBeDefined();
    console.log("group", group.id);
  });
  it("send message in group", async () => {
    await group.send("Hello");
  });
  it("sync all", async () => {
    await personas.bug.client?.conversations.syncAll();
    await personas.bob.client?.conversations.syncAll();
  });
  it("fetch  messages", async () => {
    await group.sync();
    const messages = await group.messages();
    for (const message of messages) {
      console.log("message", message.content);
    }
  });
});
