import { streamTimeout } from "@helpers/client";
import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { verifyAgentMessageStream } from "@helpers/streams";
import {
  IdentifierKind,
  type Conversation,
  type XmtpEnv,
} from "@helpers/versions";
import { setupDurationTracking } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";
import productionAgents from "./agents";
import { type AgentConfig } from "./helper";

const testName = "agents-dms";
describe(testName, async () => {
  setupDurationTracking({ testName, initDataDog: true });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const workers = await getWorkers(["bob"]);

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env as string);
  });

  // Handle case where no agents are configured for the current environment
  if (filteredAgents.length === 0) {
    it(`${testName}: No agents configured for this environment`, () => {
      console.log(`No agents found for env: ${env}`);
      expect(true).toBe(true); // Pass the test
    });
    return;
  }

  // Test each agent in DMs
  for (const agent of filteredAgents) {
    it(`${testName}: ${agent.name} DM : ${agent.address}`, async () => {
      console.log(
        `sending ${agent.sendMessage} to agent`,
        agent.name,
        agent.address,
      );
      
      // Sync conversations first to ensure we get the existing DM if it exists
      // This ensures we use the same conversation that the agent will respond in
      await workers.getCreator().client.conversations.sync();
      
      // Try to find existing DM first by listing all conversations and finding one with the agent
      let conversation: Conversation | undefined;
      const existingConversations = await workers.getCreator().client.conversations.list();
      
      // Look for a DM with the agent's address
      for (const conv of existingConversations) {
        if ((conv as any).peerInboxId) {
          // It's a DM, check if it's with the agent
          try {
            const members = await conv.members();
            const hasAgent = members.some((member) => {
              const ethIdentifier = member.accountIdentifiers.find(
                (id) => id.identifierKind === IdentifierKind.Ethereum,
              );
              return ethIdentifier?.identifier.toLowerCase() === agent.address.toLowerCase();
            });
            if (hasAgent) {
              conversation = conv;
              console.log("Found existing DM with agent:", conversation.id);
              break;
            }
          } catch (error) {
            // Skip if we can't get members
            continue;
          }
        }
      }
      
      // If no existing DM found, create a new one
      if (!conversation) {
        conversation = await workers
          .getCreator()
          .client.conversations.newDmWithIdentifier({
            identifier: agent.address,
            identifierKind: IdentifierKind.Ethereum,
          });
        console.log("Created new DM:", conversation.id);
      }
      const result = await verifyAgentMessageStream(
        conversation as Conversation,
        [workers.getCreator()],
        agent.sendMessage,
        3,
      );

      const responseTime = Math.abs(
        result?.averageEventTiming ?? streamTimeout,
      );

      // dont do ?? streamTimeout because it will be 0 and it will be ignored by datadog
      sendMetric("response", responseTime, {
        test: testName,
        metric_type: "agent",
        metric_subtype: "dm",
        live: agent.live ? "true" : "false",
        agent: agent.name,
        address: agent.address,
        sdk: workers.getCreator().sdk,
      } as ResponseMetricTags);

      if (result?.receptionPercentage === 0)
        console.error(agent.name, "ERROR: NO RESPONSE");
      else console.log(agent.name, "SUCCESS");

      if (process.env.XMTP_ENV !== "production")
        expect(result?.receptionPercentage).toBeGreaterThan(0);
    });
  }
});
