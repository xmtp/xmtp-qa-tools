import { closeEnv, listInstallations, loadEnv } from "@helpers/client";
import { type Conversation } from "@helpers/types";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "stitch";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation;
  let workers: WorkerManager;
  let ivy: Worker;
  let bob: Worker;
  let xmtp_chat: Worker;
  let alice: Worker;
  let secondWorkers: WorkerManager;
  beforeAll(async () => {
    //fs.rmSync(".data", { recursive: true, force: true });
    workers = await getWorkers(["ivy", "bob"], testName);
    ivy = workers.get("ivy")!;
    bob = workers.get("bob")!;
    secondWorkers = await getWorkers(
      ["xmtp_chat", "alice-b"],
      testName,
      "none",
      false,
    );
    xmtp_chat = secondWorkers.get("xmtp_chat")!;
    alice = secondWorkers.get("alice", "b")!;
  });

  afterAll(async () => {
    await closeEnv(testName, workers);
  });
  it("inboxState", async () => {
    await listInstallations(secondWorkers);
    await listInstallations(workers);
  });

  it("new dm with ivy with xmtp_chat ", async () => {
    convo = await ivy.client.conversations.newDm(xmtp_chat.client.inboxId);
    expect(convo.id).toBeDefined();
    console.log("convo", convo.id);
    await convo.send("hello");
  });
  it("new dm with xmtp_chat and bob", async () => {
    convo = await xmtp_chat.client.conversations.newDm(bob.client.inboxId);
    expect(convo.id).toBeDefined();
    console.log("convo", convo.id);
    await convo.send("hello");
  });
  it("new dm alice with xmtp_chat", async () => {
    convo = await alice.client.conversations.newDm(xmtp_chat.client.inboxId);
    expect(convo.id).toBeDefined();
    console.log("convo", convo.id);
    await convo.send("hello");
  });
  it("new dm xmtp_chat with alice", async () => {
    convo = await xmtp_chat.client.conversations.newDm(alice.client.inboxId);
    expect(convo.id).toBeDefined();
    console.log("convo", convo.id);
    await convo.send("hello");
  });

  it("should count conversations", async () => {
    await compareDms(xmtp_chat, alice);
    await compareDms(xmtp_chat, bob);
    await compareDms(xmtp_chat, ivy);
  });

  it("new group with xmtp_chat", async () => {
    await xmtp_chat.client.conversations.sync();
    const countofGroups = await xmtp_chat.client.conversations.listGroups();
    const groupName = "test-" + String(countofGroups.length);
    convo = await xmtp_chat.client.conversations.newGroup(
      [bob.client.inboxId, alice.client.inboxId],
      {
        groupName,
      },
    );
    expect(convo.id).toBeDefined();
    await convo.send(groupName + "\n" + String(countofGroups.length));
    console.log("convo", convo.id);
  });

  it("check xmtp_chat inbox", async () => {
    await xmtp_chat.client.conversations.sync();
    const dms = await xmtp_chat.client.conversations.listDms();
    console.log("dms", dms.length);

    const groups = await xmtp_chat.client.conversations.listGroups();
    console.log("groups", groups.length);
  });

  it("should handle different conversation IDs and require manual sync", async () => {
    workers = await getWorkers(
      ["ivy-b", "bob-b"],
      testName,
      "message",
      true,
      workers,
    );
    await listInstallations(workers);
  });

  it("should handle different conversation IDs and require manual sync", async () => {
    // Initiate a new DM with a specific conversation ID
    const newSender = workers.get("ivy", "b")!;
    const newReceiver = workers.get("bob", "b")!;
    const convo1 = await newSender.client.conversations.newDm(
      newReceiver.client.inboxId,
    );
    expect(convo1.id).toBeDefined();
    await convo1.send("Hi there!");

    // Simulate receiver listening on a different channel
    const convo2 = await ivy.client.conversations.newDm(bob.client.inboxId);
    expect(convo2.id).toBeDefined();

    const convo3 = await newReceiver.client.conversations.newDm(
      newSender.client.inboxId,
    );
    expect(convo3.id).toBeDefined();
    await convo3.send("Hi there!");
  });
  it("should count conversations", async () => {
    await compareDms(ivy, bob);
  });
});

async function compareDms(sender: Worker, receiver: Worker) {
  await receiver.client?.conversations.sync();
  await sender.client?.conversations.sync();
  const allUnique = await receiver.client?.conversations.listDms();
  const allWithDuplicates = await receiver.client?.conversations.listDms({
    includeDuplicateDms: true,
  });

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
  console.log("sender is:", sender.name + " and receiver is " + receiver.name, {
    unique: senderUnique.length,
    duplicates: senderWithDuplicates.length,
  });
}
