import { createAgent } from "@agents/factory";
import { type Agent, type AgentManager } from "@agents/manager";
import { closeEnv, loadEnv } from "@helpers/client";
import { listInstallations } from "@helpers/tests";
import { type Conversation } from "@helpers/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "stitch";
loadEnv(testName);

describe(testName, () => {
  let convo: Conversation;
  let agents: AgentManager;
  let sender: Agent;
  let receiver: Agent;

  beforeAll(async () => {
    //fs.rmSync(".data", { recursive: true, force: true });
    agents = await createAgent(["ivy", "bob"], testName);
    sender = agents.get("ivy")!;
    receiver = agents.get("bob")!;
  });

  afterAll(async () => {
    await closeEnv(testName, agents);
  });
  it("inboxState", async () => {
    await listInstallations(agents);
  });

  it("new dm with bug", async () => {
    convo = await sender.client.conversations.newDm(receiver.client.inboxId);
    expect(convo.id).toBeDefined();
    await convo.send("hello");
    console.log("convo", convo.id);
  });

  it("inboxState", async () => {
    await listInstallations(agents);
  });
  it("should count conversations", async () => {
    await compareDms(sender, receiver);
  });

  it("should handle different conversation IDs and require manual sync", async () => {
    agents = await createAgent(
      ["ivy-b", "bob-b"],
      testName,
      "message",
      true,
      agents,
    );
    await listInstallations(agents);
  });

  it("should count conversations", async () => {
    await compareDms(sender, receiver);
  });

  it("should handle different conversation IDs and require manual sync", async () => {
    // Initiate a new DM with a specific conversation ID
    const newSender = agents.get("ivy", "b")!;
    const newReceiver = agents.get("bob", "b")!;
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

async function compareDms(sender: Agent, receiver: Agent) {
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
