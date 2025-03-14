import { createAgent } from "@agents/factory";
import type { AgentManager } from "@agents/manager";
import { closeEnv, loadEnv } from "@helpers/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "bug_installation";
loadEnv(testName);

describe(testName, () => {
  let agents: AgentManager;

  beforeAll(async () => {
    agents = await createAgent(["bob", "alice", "joe"], testName, "none");
  });

  afterAll(async () => {
    await closeEnv(testName, agents);
  });

  it("inboxState", async () => {
    for (const agent of agents.getAgents()) {
      const inboxState = await agent.client.inboxState();
      console.log("Installations", inboxState.installations.length);
    }
  });

  it("should create a group with bob and alice", async () => {
    const group = await agents
      .get("bob")!
      .client.conversations.newGroup([agents.get("alice")!.client.inboxId]);
    expect(group.id).toBeDefined();
  });

  it("should create a group with bob and alice", async () => {
    const group = await agents
      .get("bob")!
      .client.conversations.newGroup([agents.get("joe")!.client.inboxId]);
    expect(group.id).toBeDefined();
  });
  it("joe with alice", async () => {
    const group = await agents
      .get("joe")!
      .client.conversations.newGroup([agents.get("alice")!.client.inboxId]);
    expect(group.id).toBeDefined();
  });
  // it("fabri creates a grop with all", async () => {
  //   const group = await personas[
  //     "fabri"
  //   ].client.conversations.newGroup([
  //     personas["bob"].client.inboxId,
  //     personas["alice"].client.inboxId,
  //     personas["joe"].client.inboxId,
  //   ]);
  //   expect(group.id).toBeDefined();
  // });
});
