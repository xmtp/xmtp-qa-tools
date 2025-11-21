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
      
      // Sync conversations first to ensure we have the latest state
      await workers.getCreator().client.conversations.sync();
      
      // Get the agent's inbox ID from the address
      let agentInboxId: string | null = null;
      try {
        const resolved = await workers.getCreator().client.getInboxIdByIdentifier({
          identifier: agent.address,
          identifierKind: IdentifierKind.Ethereum,
        });
        agentInboxId = resolved;
        console.log(`Resolved agent address ${agent.address} to inbox ID: ${agentInboxId}`);
      } catch (error) {
        console.warn(`Could not resolve inbox ID for ${agent.address}, will create new DM`);
      }
      
      // Check all existing conversations to find a DM with this agent
      const allConversations = await workers.getCreator().client.conversations.list();
      let conversation = null;
      
      // Look for existing DM with the agent by checking peerInboxId
      // If there are multiple DMs, prefer the one with the most recent activity
      if (agentInboxId) {
        const matchingDMs = allConversations.filter(
          (conv) => conv.peerInboxId && conv.peerInboxId.toLowerCase() === agentInboxId.toLowerCase()
        );
        
        if (matchingDMs.length > 0) {
          console.log(`Found ${matchingDMs.length} existing DM(s) with agent: ${matchingDMs.map(dm => dm.id).join(', ')}`);
          
          // If multiple DMs exist, try to find the one with the most recent message
          let bestDM = matchingDMs[0];
          let mostRecentTime = 0;
          
          for (const dm of matchingDMs) {
            try {
              const messages = await dm.messages({ limit: 1 });
              if (messages.length > 0 && messages[0].sentAt) {
                const messageTime = messages[0].sentAt.getTime();
                console.log(`DM ${dm.id} has message from ${new Date(messageTime).toISOString()}`);
                if (messageTime > mostRecentTime) {
                  mostRecentTime = messageTime;
                  bestDM = dm;
                }
              } else {
                console.log(`DM ${dm.id} has no messages`);
              }
            } catch (error) {
              console.log(`DM ${dm.id} error getting messages: ${error}`);
              // If we can't get messages, continue with the first DM
            }
          }
          
          conversation = bestDM;
          console.log(`Using DM: ${conversation.id} (most recent: ${mostRecentTime > 0 ? new Date(mostRecentTime).toISOString() : 'none'})`);
        }
      }
      
      // If no existing DM found, create a new one
      if (!conversation) {
        console.log(`No existing DM found, creating new one...`);
        conversation = await workers
          .getCreator()
          .client.conversations.newDmWithIdentifier({
            identifier: agent.address,
            identifierKind: IdentifierKind.Ethereum,
          });
        // Sync again after creating to ensure we have the actual conversation
        await workers.getCreator().client.conversations.sync();
        
        // After creating, check again - newDmWithIdentifier might have returned an existing DM
        if (agentInboxId) {
          const updatedConversations = await workers.getCreator().client.conversations.list();
          const allMatchingDMs = updatedConversations.filter(
            (conv) => conv.peerInboxId && conv.peerInboxId.toLowerCase() === agentInboxId.toLowerCase()
          );
          
          if (allMatchingDMs.length > 1) {
            console.log(`Warning: Found ${allMatchingDMs.length} DMs after creation. IDs: ${allMatchingDMs.map(dm => dm.id).join(', ')}`);
            // Use the one that matches what we just created, or the one with most recent activity
            const createdDM = allMatchingDMs.find(dm => dm.id === conversation.id);
            if (!createdDM) {
              // The created DM is not in the list, use the one with most recent activity
              let bestDM = allMatchingDMs[0];
              let mostRecentTime = 0;
              for (const dm of allMatchingDMs) {
                try {
                  const messages = await dm.messages({ limit: 1 });
                  if (messages.length > 0 && messages[0].sentAt) {
                    const messageTime = messages[0].sentAt.getTime();
                    if (messageTime > mostRecentTime) {
                      mostRecentTime = messageTime;
                      bestDM = dm;
                    }
                  }
                } catch (error) {
                  // Continue
                }
              }
              conversation = bestDM;
              console.log(`Switched to DM with most recent activity: ${conversation.id}`);
            }
          }
        }
      }

      console.log("DM created/found", conversation.id);
      const result = await verifyAgentMessageStream(
        conversation as Conversation,
        [workers.getCreator()],
        agent.sendMessage,
        3,
        ["text", "reply", "reaction", "actions"],
        undefined,
        agentInboxId || undefined, // Pass agent inbox ID to accept responses from agent in any DM
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
