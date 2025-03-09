import fs from "fs";
import { closeEnv, loadEnv } from "@helpers/client";
import type { Conversation, Persona } from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "installations";
loadEnv(testName);

describe(testName, () => {
  let personas: Record<string, Persona>;
  let convo: Conversation;
  beforeAll(async () => {
    fs.rmSync(".data", { recursive: true, force: true });
    personas = await getWorkers(
      ["henry", "bob-a", "bob-b", "bob-c", "bob-d"],
      testName,
      "none",
    );
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });
  it("inboxState", async () => {
    const inboxState = await personas["bob-a"].client!.inboxState();
    console.log("Installations", inboxState.installations.length);
    const inboxState2 = await personas["bob-b"].client!.inboxState();
    console.log("Installations", inboxState2.installations.length);
  });

  it("new dm with bug", async () => {
    convo = await personas.henry.client!.conversations.newDm(
      personas["bob-a"].client!.accountAddress,
    );
    expect(convo.id).toBeDefined();
    await convo.send("hello");
    console.log("convo", convo.id);
  });

  it("should count conversations", async () => {
    await personas["bob-a"].client?.conversations.sync();
    const listConversations =
      await personas["bob-a"].client?.conversations.list();
    console.log(listConversations?.length);
    expect(listConversations?.length).toBe(1);
    await personas["bob-b"].client?.conversations.sync();
    const listConversations2 =
      await personas["bob-b"].client?.conversations.list();
    console.log(listConversations2?.length);
    expect(listConversations2?.length).toBe(1);
  });
});

// if (installations.length > 1) {
//   try {
//     for (const installation of installations) {
//       await personas.bug.client?.revokeInstallations([installation.bytes]);
//     }
//     await personas.bug.client?.revokeAllOtherInstallations();
//   } catch (error) {
//     console.log(error);
//   }
// }
