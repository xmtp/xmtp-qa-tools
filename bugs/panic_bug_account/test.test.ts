import type { Installation } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeEnv, loadEnv } from "../../helpers/client";
import { type Conversation, type Persona } from "../../helpers/types";
import { getWorkers } from "../../helpers/workers/factory";

const testName = "panic_bug_account";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation | null;
  let findBugConvo: Conversation | null;
  let group: Conversation | null;
  let installations: Installation[] = [];
  let personas: Record<string, Persona>;

  beforeAll(async () => {
    // const testFilePath = __filename.split("/").slice(0, -1).join("/") + "/";
    // fs.rmSync(testFilePath + ".data", { recursive: true, force: true });

    personas = await getWorkers(["bug", "bob"], testName);
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });
  it("inboxState", async () => {
    const inboxState = await personas.bug.client?.inboxState(true);
    console.log(inboxState?.installations.length);
    installations = inboxState?.installations ?? [];
    if (installations.length > 1) {
      try {
        for (const installation of installations) {
          await personas.bug.client?.revokeInstallations([installation.bytes]);
        }
        await personas.bug.client?.revokeAllOtherInstallations();
      } catch (error) {
        console.log(error);
      }
    }
    const updatedInboxState = await personas.bug.client?.inboxState(true);
    console.log(updatedInboxState?.installations.length);
  });

  it("new dm with bug", async () => {
    convo = await personas.bob.client!.conversations.newDm(
      personas.bug.client!.accountAddress,
    );
    expect(convo.id).toBeDefined();
    console.log("convo", convo.id);
  });

  it("findBugConvo", () => {
    findBugConvo =
      personas.bug.client?.conversations.getConversationById(convo?.id ?? "") ??
      null;
    expect(findBugConvo?.id).toBeDefined();
  });
});
