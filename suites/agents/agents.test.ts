import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
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
    it(`should receive response from ${agent.name} agent (${agent.address}) when sending "${agent.sendMessage}"`, async () => {
      try {
        console.debug(`Testing ${agent.name} with address ${agent.address} `);

        const conversation = await workers
          .getCreator()
          .client.conversations.newDmWithIdentifier({
            identifier: agent.address,
            identifierKind: IdentifierKind.Ethereum,
          });
        const countBefore = (await conversation.messages()).length;

        let retries = 1;
        let agentResponded = false;
        let result;

        while (retries > 0) {
          console.warn(`${retries} tries left for ${agent.name}`);
          result = await verifyMessageStream(
            conversation as Dm,
            [workers.getCreator()],
            1,
            agent.sendMessage,
          );

          await conversation.sync();
          const messages = await conversation.messages();

          // Check if we have exactly 2 messages (sent + received)
          if (messages.length === countBefore + 2) {
            const lastMessage = messages[messages.length - 1];
            // Verify the last message is from the agent (not from us)
            if (
              lastMessage.senderInboxId.toLowerCase() !==
              workers.getCreator().client.inboxId.toLowerCase()
            ) {
              console.debug(
                `${agent.name} with address ${agent.address} responded with message`,
              );
              agentResponded = true;
              break;
            }
          }

          // Also check if verifyMessageStream confirms reception
          else if (result?.allReceived) {
            console.debug(
              `${agent.name} with address ${agent.address} passed via verifyMessageStream`,
            );
            agentResponded = true;
            break;
          }

          retries--;
        }

        expect(agentResponded).toBe(true);
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
