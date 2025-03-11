import { closeEnv, loadEnv } from "@helpers/client";
import { listInstallations } from "@helpers/tests";
import {
  type Conversation,
  type NestedPersonas,
  type Persona,
} from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "stitch";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation | null;
  let personas: NestedPersonas;
  let sender: Persona;
  let receiver: Persona;

  beforeAll(async () => {
    //fs.rmSync(".data", { recursive: true, force: true });
    personas = await getWorkers(["henry", "ivy", "bob"], testName);
    sender = personas.get("henry")!;
    receiver = personas.get("bob")!;
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });
  it("inboxState", async () => {
    await listInstallations(personas);
  });

  it("new dm with bug", async () => {
    convo = await sender.client!.conversations.newDm(
      receiver.client!.accountAddress,
    );
    expect(convo.id).toBeDefined();
    await convo.send("hello");
    console.log("convo", convo.id);
  });

  it("inboxState", async () => {
    await listInstallations(personas);
  });
  it("should count conversations", async () => {
    await receiver.client?.conversations.sync();
    const listUniqueConversations =
      await receiver.client?.conversations.listDms({
        includeDuplicateDms: false,
      });
    const listDuplicateConversations =
      await receiver.client?.conversations.listDms({
        includeDuplicateDms: true,
      });
    console.log("listUniqueConversations", listUniqueConversations?.length);
    console.log(
      "listDuplicateConversations",
      listDuplicateConversations?.length,
    );
  });

  it("inboxState", async () => {
    await listInstallations(personas);
  });

  it("should handle different conversation IDs and require manual sync", async () => {
    await sender.worker?.clearDB(); // Hypothetical method to clear local data
    await sender.worker?.initialize();
    await listInstallations(personas);
  });
  // it("should handle different conversation IDs and require manual sync", async () => {
  //   // Initiate a new DM with a specific conversation ID
  //   const convo1 = await sender.client!.conversations.newDm(
  //     receiver.client!.accountAddress,
  //   );
  //   expect(convo1.id).toBeDefined();
  //   await convo1.send("Hi there!");

  //   // Simulate receiver listening on a different channel
  //   const convo2 = await receiver.client!.conversations.newDm(
  //     sender.client!.accountAddress,
  //   );
  //   expect(convo2.id).toBeDefined();

  //   // Verify that the message is not received until sync
  //   await receiver.client?.conversations.sync();
  //   const listConversations = receiver.client?.conversations.listDms({
  //     includeDuplicateDms: true,
  //   });
  //   console.log(
  //     "Conversations for receiver after sync:",
  //     listConversations?.length,
  //   );
  //   expect(listConversations?.length).toBeGreaterThanOrEqual(1);
  // });
});
