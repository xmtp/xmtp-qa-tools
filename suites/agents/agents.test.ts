import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Dm } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import productionAgents from "./production.json";

const testName = "agents";
loadEnv(testName);

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
    expect,
  });

  const filteredAgents = productionAgents.filter((agent) => {
    return agent.networks.includes(env) && !agent.disabled;
  });
  // For local testing, test all agents on their supported networks
  for (const agent of filteredAgents) {
    it(`test ${agent.name}:${agent.address} on ${process.env.XMTP_ENV}`, async () => {
      try {
        console.debug(`Testing ${agent.name} with address ${agent.address} `);

        const conversation = await workers
          .getCreator()
          .client.conversations.newDmWithIdentifier({
            identifier: agent.address,
            identifierKind: IdentifierKind.Ethereum,
          });
        const countBefore = (await conversation.messages()).length;

        const result = await verifyMessageStream(
          conversation as Dm,
          [workers.getCreator()],
          1,
          agent.sendMessage,
        );
        if (!result.allReceived) {
          await conversation.sync();
          const messages = await conversation.messages();
          expect(messages.length).toBe(countBefore + 2);
        }
        expect(result.allReceived).toBe(true);
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
