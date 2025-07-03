import { streamTimeout } from "@helpers/client";
import { sendMetric } from "@helpers/datadog";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type XmtpEnv } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import productionAgents from "./agents.json";
import { type AgentConfig } from "./helper";

const testName = "agents-groups";

describe(testName, async () => {
  const env = process.env.XMTP_ENV as XmtpEnv;
  const workers = await getWorkers(["alice", "bob"]);

  setupTestLifecycle({});

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env);
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

  // Test ALL agents in groups (both responding and non-responding)
  for (const agent of filteredAgents) {
    const testType = agent.groupTesting === true ? "Responds" : "No Response";
    it(`${env}: ${agent.name} Group ${testType} : ${agent.address}`, async () => {
      // Create a group with the agent
      const group = await workers
        .getCreator()
        .client.conversations.newGroup([workers.getReceiver().client.inboxId]);

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

      // Step 2: Send either slash command or tagged message based on agent type
      const isSlashCommand = agent.sendMessage.startsWith("/");
      const testMessage = isSlashCommand
        ? agent.sendMessage // Use slash command directly
        : `@${agent.baseName} ${agent.sendMessage}`; // Use tagged message

      await group.send(testMessage);

      // Wait longer for response
      let messagesAfterCommand = await waitForMessages(
        group,
        countAfterHi + 2,
        15000,
      );
      const countAfterCommand = messagesAfterCommand.length;

      // Should have our command message + agent response (only if groupTesting: true)
      const respondedToCommand = countAfterCommand >= countAfterHi + 2;

      // Calculate response time for command message
      let responseTime = streamTimeout;
      if (respondedToCommand && messagesAfterCommand.length >= 2) {
        const commandMsg = messagesAfterCommand[
          messagesAfterCommand.length - 2
        ] as {
          sentAt?: number;
        };
        const responseMsg = messagesAfterCommand[
          messagesAfterCommand.length - 1
        ] as {
          sentAt?: number;
        };
        const commandMessageTime = Number(commandMsg?.sentAt) || 0;
        const responseMessageTime = Number(responseMsg?.sentAt) || 0;
        if (commandMessageTime && responseMessageTime) {
          responseTime = responseMessageTime - commandMessageTime;
        }
      }

      // Determine expected behavior based on groupTesting setting
      const shouldRespondToCommand = agent.groupTesting === true;

      sendMetric(
        "response",
        respondedToCommand ? responseTime : streamTimeout,
        {
          test: testName,
          metric_type: "agent",
          metric_subtype: "group",
          agent: agent.name,
          address: agent.address,
          sdk: workers.getCreator().sdk,
        },
      );

      // Test assertions
      expect(noResponseToHi).toBe(true); // Should NEVER respond to untagged "hi"

      if (shouldRespondToCommand) {
        expect(respondedToCommand).toBe(true); // SHOULD respond to command/tagged message
      } else {
        expect(respondedToCommand).toBe(false); // Should NOT respond to command/tagged message
      }
    });
  }
});
