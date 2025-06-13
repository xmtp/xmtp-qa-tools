import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Dm } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";
import productionAgents from "./production.json";

// Define the types for the agents
interface Agent {
  name: string;
  address: string;
  sendMessage: string;
  expectedMessage: string[];
  networks: string[];
  disabled: boolean;
}

const testName = "agents";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  beforeAll(async () => {
    workers = await getWorkers(
      ["bot"],
      testName,
      typeofStream.Message,
      typeOfResponse.None,
      typeOfSync.None,
      process.env.XMPT_ENV as "dev" | "production",
    );
  });
  setupTestLifecycle({
    expect,
  });

  const filteredAgents = productionAgents.filter((agent) => {
    if (process.env.XMPT_ENV === "dev") {
      return agent.networks.includes("dev") && !agent.disabled;
    }
    return agent.networks.includes("production") && !agent.disabled;
  });
  // For local testing, test all agents on their supported networks
  for (const agent of filteredAgents) {
    it(`test ${agent.name}:${agent.address} on ${process.env.XMPT_ENV}`, async () => {
      try {
        console.debug(`Testing ${agent.name} with address ${agent.address} `);

        const conversation = await workers
          .getCreator()
          .client.conversations.newDmWithIdentifier({
            identifier: agent.address,
            identifierKind: IdentifierKind.Ethereum,
          });

        const result = await verifyMessageStream(
          conversation as Dm,
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
