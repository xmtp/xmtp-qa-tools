import { streamTimeout } from "@helpers/client";
import { sendMetric } from "@helpers/datadog";
import { verifyBotMessageStream } from "@helpers/streams";
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
    it(`${env}: ${agent.name} should not respond to untagged "hi" : ${agent.address}`, async () => {
      const group = await createGroupWithAgent(agent);

      const hiResult = await verifyBotMessageStream(
        group as Conversation,
        [workers.getReceiver()],
        agent.sendMessage,
      );

      expect(hiResult.allReceived).toBe(false);
    });

    if (agent.shouldRespondOnTagged) {
      it(`${env}: ${agent.name} should respond to tagged/command message : ${agent.address}`, async () => {
        const group = await createGroupWithAgent(agent);

        const isSlashCommand = agent.sendMessage.startsWith("/");
        const testMessage = isSlashCommand
          ? agent.sendMessage
          : `@${agent.baseName} ${agent.sendMessage}`;

        const commandResult = await verifyBotMessageStream(
          group as Conversation,
          [workers.getReceiver()],
          testMessage,
        );

        sendMetric("response", commandResult.averageEventTiming, {
          test: testName,
          metric_type: "agent",
          metric_subtype: "group",
          agent: agent.name,
          address: agent.address,
          sdk: workers.getCreator().sdk,
        });

        expect(commandResult.allReceived).toBe(true);
      });
    }
  }
});
