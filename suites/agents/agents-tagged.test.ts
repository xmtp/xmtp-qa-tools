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

const testName = "agents-tagged";

describe(testName, async () => {
  setupTestLifecycle({ testName });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const workers = await getWorkers(["randomguy"]);

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env) && agent.shouldRespondOnTagged;
  });

  for (const agent of filteredAgents) {
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

      expect(result?.allReceived).toBe(true);
    });
  }
});
