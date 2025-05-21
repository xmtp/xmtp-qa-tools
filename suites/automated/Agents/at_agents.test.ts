import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { IdentifierKind } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import productionAgents from "./production.json";

// Define the types for the agents
interface Agent {
  name: string;
  address: string;
  sendMessage: string;
  expectedMessage: string[];
}

// Type assertion for imported JSON
const typedAgents = productionAgents as Agent[];
const testName = "at_agents";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  beforeAll(async () => {
    workers = await getWorkers(
      ["bot"],
      testName,
      typeofStream.Message,
      typeOfResponse.None,
      "production",
    );
  });
  setupTestLifecycle({
    expect,
  });

  // For local testing, test all agents on their supported networks
  for (const agent of typedAgents) {
    it(`test ${agent.name}:${agent.address} on production`, async () => {
      try {
        console.debug(`Testing ${agent.name} with address ${agent.address} `);

        const conversation = await workers
          .getCreator()
          .client.conversations.newDmWithIdentifier({
            identifier: agent.address,
            identifierKind: IdentifierKind.Ethereum,
          });

        const result = await verifyMessageStream(
          conversation,
          [workers.getCreator()],
          1,
          agent.sendMessage,
        );
        expect(result.allReceived).toBe(true);
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
