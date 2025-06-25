import { getRandomNames, streamTimeout } from "@helpers/client";
import { sendMetric } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import { verifyBotMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import productionAgents from "@inboxes/agents.json";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Dm } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "agents";

describe(testName, () => {
  let workers: WorkerManager;
  const env = process.env.XMTP_ENV as "dev" | "production";
  beforeAll(async () => {
    workers = await getWorkers(
      getRandomNames(1),
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
    return agent.networks.includes(env);
  });
  // For local testing, test all agents on their supported networks
  for (const agent of filteredAgents) {
    it(`${env}: ${agent.name} : ${agent.address}`, async () => {
      try {
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

        let retries = 3;
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
          JSON.stringify(messages[messages.length - 1].content, null, 2),
          "received in",
          result?.averageEventTiming,
        );

        let metricValue = result?.averageEventTiming as number;
        if (!agentResponded) metricValue = streamTimeout;

        sendMetric("response", metricValue, {
          metric_type: "agent",
          metric_subtype: agent.name,
          agent: agent.name,
          address: agent.address,
          test: testName,
          env: process.env.XMTP_ENV as string,
          region: process.env.GEOLOCATION as string,
          libxmtp: process.env.LIBXMTP_VERSION as string,
          sdk: process.env.XMTP_SDK_VERSION as string,
          operation: "agent",
          country_iso_code: process.env.GEOLOCATION as string,
        });
        expect(agentResponded).toBe(true);
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
