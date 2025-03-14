import { createAgent } from "@agents/factory";
import type { Agent, AgentManager } from "@agents/manager";
import { closeEnv, loadEnv } from "@helpers/client";
import { verifyConversationStream } from "@helpers/verify";
import { afterAll, beforeAll, describe, it } from "vitest";

const testName = "conversations";
loadEnv(testName);

describe(testName, () => {
  let agents: AgentManager;

  let sender: Agent;
  let participants: Agent[];
  beforeAll(async () => {
    agents = await createAgent(
      [
        "henry",
        "ivy",
        "jack",
        "karen",
        "randomguy",
        "larry",
        "mary",
        "nancy",
        "oscar",
      ],
      testName,
      "conversation",
    );
  });

  afterAll(async () => {
    await closeEnv(testName, agents);
  });

  it("detects new group conversation creation with three participants", async () => {
    sender = agents.get("henry")!;
    participants = [agents.get("nancy")!, agents.get("oscar")!];

    await verifyConversationStream(sender, participants);
  });

  it("detects new group conversation with all available personas", async () => {
    const sender = agents.get("henry")!;
    const participants = [
      agents.get("nancy")!,
      agents.get("oscar")!,
      agents.get("jack")!,
      agents.get("ivy")!,
    ];

    await verifyConversationStream(sender, participants);
  });
});
