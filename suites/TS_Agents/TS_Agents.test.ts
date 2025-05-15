import { loadEnv } from "@helpers/client";
import { verifyDmStream } from "@helpers/streams";
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
const testName = "TS_Agents";
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
      console.debug(`Testing ${agent.name} with address ${agent.address} `);
      const convo = await workers
        .get("bot")
        ?.client.conversations.newDmWithIdentifier({
          identifier: agent.address,
          identifierKind: IdentifierKind.Ethereum,
        });
      expect(convo).toBeDefined();
      const result = await verifyDmStream(
        convo!,
        workers.getWorkers(),
        agent.sendMessage,
      );
      if (!result.allReceived) {
        console.error(`${agent.name} failed to respond in under 10 seconds`);
      }
    });
  }
});
