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
  let personas: Record<string, Persona>;

  beforeAll(async () => {
    // const testFilePath = __filename.split("/").slice(0, -1).join("/") + "/";
    //    fs.rmSync(testFilePath + ".data", { recursive: true, force: true });

    personas = await getWorkers(["bug2", "bug", "bob"], testName);
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

  // it("new dm with bug", async () => {
  //   const convoWithBug = await personas.bob.client!.conversations.newDm(
  //     personas.bug.client!.accountAddress,
  //   );
  //   expect(convoWithBug.id).toBeDefined();
  //   console.log("convoWithBug", convoWithBug.id);
  //   await personas.bug.client?.conversations.syncAll();
  //   const findBugConvo = personas.bug.client?.conversations.getConversationById(
  //     convoWithBug.id,
  //   );

  //   expect(findBugConvo?.id).toBeUndefined();
  //   console.log("Conversation not found");
  // });

  it("new dm with bug2", async () => {
    const convoWithBug2 = await personas.bob.client!.conversations.newDm(
      personas.bug2.client!.accountAddress,
    );
    expect(convoWithBug2.id).toBeDefined();
    console.log("convoWithBug2", convoWithBug2.id);
    await personas.bug2.client?.conversations.syncAll();
    const findBugConvo2 =
      personas.bug2.client?.conversations.getConversationById(convoWithBug2.id);

    expect(findBugConvo2?.id).toBe(convoWithBug2.id);
    console.log("Conversation found");

    const messagesfrombug2 = await convoWithBug2.messages();
    console.log("messagesfrombug2", messagesfrombug2.length);
    expect(messagesfrombug2.length).toBeGreaterThan(0);

    await convoWithBug2.send("gm");
    await findBugConvo2?.sync();
    const messagesfrombug22 = await findBugConvo2?.messages();
    console.log("messagesfrombug22", messagesfrombug22?.length);
    expect(messagesfrombug22?.length).toBe(messagesfrombug2.length);
  });
});
