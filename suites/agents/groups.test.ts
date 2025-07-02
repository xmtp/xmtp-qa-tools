import { streamTimeout } from "@helpers/client";
import { sendMetric } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { IdentifierKind } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import { type AgentConfig } from "./agents";
import productionAgents from "./agents.json";

const testName = "agents-groups";

describe(testName, async () => {
  const env = process.env.XMTP_ENV as "dev" | "production";
  const workers = await getWorkers(["alice", "bob"]);

  setupTestLifecycle({});

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env) && agent.groupTesting === true;
  });

  // Helper function to wait for messages in group
  async function waitForMessages(
    group: unknown,
    expectedCount: number,
    timeoutMs = 10000,
  ): Promise<unknown[]> {
    const startTime = Date.now();
    const g = group as {
      sync: () => Promise<void>;
      messages: () => Promise<unknown[]>;
    };

    while (Date.now() - startTime < timeoutMs) {
      await g.sync();
      const messages = await g.messages();
      if (messages.length >= expectedCount) {
        return messages;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return await g.messages();
  }

  // Test each agent in groups
  for (const agent of filteredAgents) {
    it(`${env}: ${agent.name} Group Test : ${agent.address}`, async () => {
      try {
        // Create a group with the agent
        const group = await workers
          .getCreator()
          .client.conversations.newGroup([
            workers.getReceiver().client.inboxId,
          ]);

        // Add the agent to the group by creating a DM first to get their inbox ID
        const agentDm = await workers
          .getCreator()
          .client.conversations.newDmWithIdentifier({
            identifier: agent.address,
            identifierKind: IdentifierKind.Ethereum,
          });
        await agentDm.sync();

        // Try to find agent's inbox ID and add to group
        try {
          const members = await agentDm.members();
          const agentMember = members.find((member: unknown) => {
            const m = member as { addresses?: string[] };
            return m.addresses?.some(
              (addr: string) =>
                addr.toLowerCase() === agent.address.toLowerCase(),
            );
          }) as { inboxId?: string } | undefined;

          if (agentMember?.inboxId) {
            await group.addMembers([agentMember.inboxId]);
            await group.sync();
          }
        } catch (e) {
          console.warn(
            `Could not add agent ${agent.name} to group: ${String(e)}`,
          );
          // Continue with test anyway
        }

        await group.sync();
        let initialMessages = await group.messages();
        const initialCount = initialMessages.length;

        // Step 1: Send untagged "hi" message (agent should NOT respond)
        await group.send("hi");
        await waitForMessages(group, initialCount + 1, 5000); // Wait 5 seconds

        let messagesAfterHi = await group.messages();
        const countAfterHi = messagesAfterHi.length;

        // Should have only our "hi" message, no response from agent
        const noResponseToHi = countAfterHi === initialCount + 1;

        // Step 2: Send tagged message using baseName (agent SHOULD respond)
        const taggedMessage = `@${agent.baseName} ${agent.sendMessage}`;
        await group.send(taggedMessage);

        // Wait longer for tagged response
        let messagesAfterTag = await waitForMessages(
          group,
          countAfterHi + 2,
          15000,
        );
        const countAfterTag = messagesAfterTag.length;

        // Should have our tagged message + agent response
        const respondedToTag = countAfterTag >= countAfterHi + 2;

        // Calculate response time for tagged message
        let responseTime = streamTimeout;
        if (respondedToTag && messagesAfterTag.length >= 2) {
          const taggedMsg = messagesAfterTag[messagesAfterTag.length - 2] as {
            sentAt?: number;
          };
          const responseMsg = messagesAfterTag[messagesAfterTag.length - 1] as {
            sentAt?: number;
          };
          const taggedMessageTime = Number(taggedMsg?.sentAt) || 0;
          const responseMessageTime = Number(responseMsg?.sentAt) || 0;
          if (taggedMessageTime && responseMessageTime) {
            responseTime = responseMessageTime - taggedMessageTime;
          }
        }

        // Send metrics
        sendMetric("response", noResponseToHi ? 0 : streamTimeout, {
          test: testName,
          metric_type: "agent",
          metric_subtype: `${agent.name}-group-untagged`,
          agent: agent.name,
          address: agent.address,
          sdk: workers.getCreator().sdk,
        });

        sendMetric("response", respondedToTag ? responseTime : streamTimeout, {
          test: testName,
          metric_type: "agent",
          metric_subtype: `${agent.name}-group-tagged`,
          agent: agent.name,
          address: agent.address,
          sdk: workers.getCreator().sdk,
        });

        // Test assertions
        expect(noResponseToHi).toBe(true); // Should NOT respond to "hi"
        expect(respondedToTag).toBe(true); // SHOULD respond to tagged message
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
