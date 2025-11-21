import { streamTimeout } from "@helpers/client";
import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { verifyAgentMessageStream } from "@helpers/streams";
import {
  IdentifierKind,
  type Conversation,
  type Dm,
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
      
      // Sync conversations first to ensure we have the latest state
      // This is important because the agent might respond on an existing DM
      await workers.getCreator().client.conversations.sync();
      
      // Try to find an existing DM with this peer first
      const allConversations = await workers.getCreator().client.conversations.list();
      let conversation: Conversation | undefined;
      
      // Look for an existing DM with matching peer address
      for (const conv of allConversations) {
        // Type guard to check if it's a DM
        if ('peerInboxId' in conv) {
          const dm = conv as Dm;
          // It's a DM, check if the peer matches by getting members and checking Ethereum address
          try {
            const members = await dm.members();
            const peerMember = members.find(
              (m) => m.inboxId.toLowerCase() !== workers.getCreator().client.inboxId.toLowerCase()
            );
            if (peerMember) {
              const peerEthId = peerMember.accountIdentifiers.find(
                (id) => id.identifierKind === IdentifierKind.Ethereum
              );
              if (peerEthId && peerEthId.identifier.toLowerCase() === agent.address.toLowerCase()) {
                console.log(`Found existing DM: ${dm.id} (peer: ${agent.address})`);
                conversation = dm as Conversation;
                break;
              }
            }
          } catch (error) {
            // Skip this conversation if we can't get members
            console.debug(`Skipping conversation ${dm.id}, error getting members:`, error);
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
        console.log("DM created", conversation.id);
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
