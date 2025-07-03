import { streamTimeout } from "@helpers/client";
import { sendMetric } from "@helpers/datadog";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import {
  IdentifierKind,
  type Conversation,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import productionAgents from "./agents.json";
import { type AgentConfig } from "./helper";

const testName = "agents-groups";

describe(testName, async () => {
  const env = process.env.XMTP_ENV as XmtpEnv;
  const workers = await getWorkers(["alice", "bob"]);

  setupTestLifecycle({ testName });

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env);
  });

  async function createGroupWithAgent(agent: AgentConfig) {
    const group = await workers
      .getCreator()
      .client.conversations.newGroup([workers.getReceiver().client.inboxId]);

    const agentDm = await workers
      .getCreator()
      .client.conversations.newDmWithIdentifier({
        identifier: agent.address,
        identifierKind: IdentifierKind.Ethereum,
      });
    await agentDm.sync();

    try {
      const members = await agentDm.members();
      const agentMember = members.find((member: unknown) => {
        const m = member as { addresses?: string[] };
        return m.addresses?.some(
          (addr: string) => addr.toLowerCase() === agent.address.toLowerCase(),
        );
      }) as { inboxId?: string } | undefined;

      if (agentMember?.inboxId) {
        await group.addMembers([agentMember.inboxId]);
        await group.sync();
      }
    } catch (e) {
      console.warn(`Could not add agent ${agent.name} to group: ${String(e)}`);
    }

    await group.sync();
    return group;
  }

  for (const agent of filteredAgents) {
    it(`${env}: ${agent.name} group behavior test : ${agent.address}`, async () => {
      const group = await createGroupWithAgent(agent);

      // Test 1: Send untagged "hi" - agent should NOT respond
      const hiResult = await verifyMessageStream(
        group as Conversation,
        [workers.getReceiver()],
        1,
        "hi",
      );

      const noResponseToHi =
        hiResult.receiverCount === 1 &&
        hiResult.messages.split(",").length === 1;

      // Test 2: Send tagged/command message - agent should respond
      const isSlashCommand = agent.sendMessage.startsWith("/");
      const testMessage = isSlashCommand
        ? agent.sendMessage
        : `@${agent.baseName} ${agent.sendMessage}`;

      const commandResult = await verifyMessageStream(
        group as Conversation,
        [workers.getReceiver()],
        1,
        testMessage,
      );

      const respondedToCommand = commandResult.messages.split(",").length >= 2;
      const responseTime = respondedToCommand
        ? commandResult.averageEventTiming
        : streamTimeout;

      sendMetric("response", responseTime, {
        test: testName,
        metric_type: "agent",
        metric_subtype: "group",
        agent: agent.name,
        address: agent.address,
        sdk: workers.getCreator().sdk,
      });

      // Assertions
      expect(noResponseToHi).toBe(true); // Should NEVER respond to untagged "hi"
      expect(respondedToCommand).toBe(true); // SHOULD respond to command/tagged message
    });
  }
});
