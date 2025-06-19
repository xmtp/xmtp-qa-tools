import { sendMetric } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import { verifyBotMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Dm } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import productionAgents from "./production.json";

const testName = "agents";

describe(testName, () => {
  let workers: WorkerManager;
  const env = process.env.XMTP_ENV as "dev" | "production";
  beforeAll(async () => {
    workers = await getWorkers(
      ["bot"],
      testName,
      typeofStream.Message,
      typeOfResponse.None,
      typeOfSync.None,
      env,
    );
  });
  setupTestLifecycle({
    testName,
    expect,
  });

  const filteredAgents = productionAgents.filter((agent) => {
    return agent.networks.includes(env) && !agent.disabled;
  });
  // For local testing, test all agents on their supported networks
  for (const agent of filteredAgents) {
    it(`${agent.name} : ${agent.address} : ${env}`, async () => {
      try {
        let retries = 3; // Move retries inside each test for fresh count
        console.warn(`Testing ${agent.name} with address ${agent.address} `);

        const conversation = await workers
          .getCreator()
          .client.conversations.newDmWithIdentifier({
            identifier: agent.address,
            identifierKind: IdentifierKind.Ethereum,
          });
        await conversation.sync();
        let messages = await conversation.messages();
        let countBefore = messages.length;

        let agentResponded = false;
        let result;

        while (retries > 0) {
          messages = await conversation.messages();
          countBefore = messages.length;

          result = await verifyBotMessageStream(
            conversation as Dm,
            [workers.getCreator()],
            agent.sendMessage,
          );

          if (result?.allReceived) {
            console.warn("result?.allReceived");
            agentResponded = true;
            break;
          }

          await conversation.sync();
          messages = await conversation.messages();
          // Check if we have exactly 2 messages (sent + received)
          if (messages.length === countBefore + 2) {
            console.warn("messages.length === countBefore + 2");
            agentResponded = true;
            break;
          }
          retries--;
        }

        console.warn(
          "lastMessage",
          messages[messages.length - 1].content,
          "received in",
          result?.averageEventTiming,
        );

        sendMetric("agents", result?.averageEventTiming ?? 0, {
          agent: agent.name,
          address: agent.address,
          test: testName,
          metric_type: "responseTime",
          metric_subtype: agent.name,
        });
        expect(agentResponded).toBe(true);
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
