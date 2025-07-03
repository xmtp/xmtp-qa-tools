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
  const workers = await getWorkers(["randomguy"]);

  setupTestLifecycle({ testName });

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env);
  });

  for (const agent of filteredAgents) {
    // it(`${env}: ${agent.name} should not respond to untagged "hi" : ${agent.address}`, async () => {
    //   console.debug("sending message to agent", agent.name, agent.address);
    //   const conversation = await workers
    //     .getCreator()
    //     .client.conversations.newGroupWithIdentifiers([
    //       {
    //         identifier: agent.address,
    //         identifierKind: IdentifierKind.Ethereum,
    //       },
    //     ]);

    //   const result = await verifyBotMessageStream(
    //     conversation as Conversation,
    //     [workers.getCreator()],
    //     "hi",
    //     1,
    //   );

    //   sendMetric("response", result.averageEventTiming || streamTimeout, {
    //     test: testName,
    //     metric_type: "agent",
    //     metric_subtype: "group",
    //     agent: agent.name,
    //     address: agent.address,
    //     sdk: workers.getCreator().sdk,
    //   });

    //   expect(result.allReceived).toBe(false);
    // });

    if (agent.shouldRespondOnTagged) {
      it(`${env}: ${agent.name} should respond to tagged/command message : ${agent.address}`, async () => {
        const isSlashCommand = agent.sendMessage.startsWith("/");
        const testMessage = isSlashCommand
          ? agent.sendMessage
          : `@${agent.baseName} ${agent.sendMessage}`;

        console.debug(
          `sending ${testMessage} to agent`,
          agent.name,
          agent.address,
        );
        const conversation = await workers
          .getCreator()
          .client.conversations.newGroupWithIdentifiers([
            {
              identifier: agent.address,
              identifierKind: IdentifierKind.Ethereum,
            },
          ]);

        const result = await verifyBotMessageStream(
          conversation as Conversation,
          [workers.getCreator()],
          testMessage,
          3,
        );

        sendMetric("response", result.averageEventTiming || streamTimeout, {
          test: testName,
          metric_type: "agent",
          metric_subtype: "group",
          agent: agent.name,
          address: agent.address,
          sdk: workers.getCreator().sdk,
        });

        expect(result.allReceived).toBe(true);
      });
    }
  }
});
