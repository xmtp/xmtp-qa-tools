import { createAgent } from "@agents/factory";
import { loadEnv } from "@helpers/client";
import { describe, expect, it } from "vitest";

const testName = "bug_panic";
loadEnv(testName);

describe(testName, () => {
  it("createGroupByInboxIds: should measure creating a group with inbox ids", async () => {
    const agents = await createAgent(50, testName);
    const groupByInboxIds = await agents
      .get("bob")!
      .client.conversations.newGroup(
        agents.getAgents().map((agent) => agent.client.inboxId),
      );
    for (const agent of agents.getAgents()) {
      await agent.worker?.terminate();
    }
    expect(groupByInboxIds.id).toBeDefined();
  });
});
