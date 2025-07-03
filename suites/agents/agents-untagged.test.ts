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

const testName = "agents-untagged";

describe(testName, async () => {
  setupTestLifecycle({ testName });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const workers = await getWorkers(["randomguy"]);

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env) && agent.shouldRespondOnTagged;
  });

  for (const agent of filteredAgents) {
    it(`${env}: ${agent.name} should not respond to untagged "hi" : ${agent.address}`, async () => {
      console.debug("sending message to agent", agent.name, agent.address);
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
        "hi",
        1,
      );
      expect(result?.allReceived).toBe(false);
    });
  }
});
