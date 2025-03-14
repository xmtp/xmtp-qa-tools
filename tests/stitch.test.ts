import { closeEnv, loadEnv } from "@helpers/client";
import { listInstallations } from "@helpers/tests";
import { type Conversation } from "@helpers/types";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "stitch";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation;
  let personas: WorkerManager;
  let sender: Worker;
  let receiver: Worker;

  beforeAll(async () => {
    //fs.rmSync(".data", { recursive: true, force: true });
    personas = await getWorkers(["ivy", "bob"], testName);
    sender = personas.get("ivy")!;
    receiver = personas.get("bob")!;
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });
  it("inboxState", async () => {
    await listInstallations(personas);
  });

  it("new dm with bug", async () => {
    convo = await sender.client.conversations.newDm(receiver.client.inboxId);
    expect(convo.id).toBeDefined();
    await convo.send("hello");
    console.log("convo", convo.id);
  });

  it("inboxState", async () => {
    await listInstallations(personas);
  });
  it("should count conversations", async () => {
    await compareDms(sender, receiver);
  });

  it("should handle different conversation IDs and require manual sync", async () => {
    personas = await getWorkers(
      ["ivy-b", "bob-b"],
      testName,
      "message",
      true,
      personas,
    );
    await listInstallations(personas);
  });

  it("should count conversations", async () => {
    await compareDms(sender, receiver);
  });

  it("should handle different conversation IDs and require manual sync", async () => {
    // Initiate a new DM with a specific conversation ID
    const newSender = personas.get("ivy", "b")!;
    const newReceiver = personas.get("bob", "b")!;
    const convo1 = await newSender.client.conversations.newDm(
      newReceiver.client.inboxId,
    );
    expect(convo1.id).toBeDefined();
    await convo1.send("Hi there!");

    // Simulate receiver listening on a different channel
    const convo2 = await sender.client.conversations.newDm(
      newReceiver.client.inboxId,
    );
    expect(convo2.id).toBeDefined();

    const convo3 = await newReceiver.client.conversations.newDm(
      newSender.client.inboxId,
    );
    expect(convo3.id).toBeDefined();
    await convo3.send("Hi there!");
  });
  it("should count conversations", async () => {
    await compareDms(sender, receiver);
  });
});

async function compareDms(sender: Worker, receiver: Worker) {
  await receiver.client?.conversations.sync();
  const allUnique = (await receiver.client?.conversations.listDms()) ?? [];
  const allWithDuplicates =
    (await receiver.client?.conversations.listDms({
      includeDuplicateDms: true,
    })) ?? [];

  // Save filtered results
  const senderUnique = allUnique.filter((conversation) => {
    return sender.client?.inboxId === conversation.peerInboxId;
  });

  const senderWithDuplicates = allWithDuplicates.filter((conversation) => {
    return sender.client?.inboxId === conversation.peerInboxId;
  });

  // Log details of all conversations
  console.log(
    "All unique conversations:",
    allUnique.map((c) => ({
      id: c.id,
      peerInboxId: c.peerInboxId,
    })),
  );

  console.log(
    "Filtered unique conversations:",
    senderUnique.map((c) => ({
      id: c.id,
      peerInboxId: c.peerInboxId,
    })),
  );

  expect(senderUnique.length).toBe(1);
  console.log("listUniqueConversations", senderUnique.length);
  console.log("listDuplicateConversations", senderWithDuplicates.length);
}
