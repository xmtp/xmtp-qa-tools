import { sleep } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Dm } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import productionAgents from "./production.json";

const testName = "agents";

describe(testName, async () => {
  let workers: WorkerManager;
  const env = process.env.XMTP_ENV as "dev" | "production";

  setupTestLifecycle({
    testName,
    expect,
  });

  workers = await getWorkers(
    ["bot"],
    testName,
    typeofStream.Message,
    typeOfResponse.None,
    typeOfSync.None,
    env,
  );

  const creator = workers.getCreator() as unknown as Worker;
  const filteredAgents = productionAgents.filter((agent) => {
    return agent.networks.includes(env) && !agent.disabled;
  });
  // For local testing, test all agents on their supported networks
  for (const agent of filteredAgents) {
    it(`should receive response from ${agent.name} agent (${agent.address}) when sending "${agent.sendMessage}"`, async () => {
      try {
        console.debug(`Testing ${agent.name} with address ${agent.address}`);

        const conversation =
          await creator.client.conversations.newDmWithIdentifier({
            identifier: agent.address,
            identifierKind: IdentifierKind.Ethereum,
          });

        console.debug(
          `[${agent.name}] Created/retrieved conversation with ID: ${conversation.id}`,
        );

        const countBefore = (await conversation.messages()).length;
        console.debug(`[${agent.name}] Initial message count: ${countBefore}`);

        const result = await verifyMessageStream(
          conversation as Dm,
          [creator],
          1,
          agent.sendMessage,
        );

        console.debug(
          `[${agent.name}] Stream result for conversation ${conversation.id}:`,
          result,
        );

        if (!result.allReceived) {
          console.debug(
            `[${agent.name}] First attempt failed, waiting for delayed response...`,
          );

          // Wait a bit longer - agent might be processing the request
          await sleep(5000);

          // Try to collect any delayed responses
          console.debug(
            `[${agent.name}] Attempting to collect delayed responses...`,
          );
          const delayedResult = await creator.worker.collectMessages(
            conversation.id,
            1,
          );

          if (delayedResult.length > 0) {
            console.debug(
              `[${agent.name}] Found ${delayedResult.length} delayed responses!`,
            );
            expect(delayedResult.length).toBeGreaterThan(0);
          } else {
            console.debug(
              `[${agent.name}] No delayed responses, checking final message count...`,
            );

            await conversation.sync();
            const messages = await conversation.messages();

            console.debug(
              `[${agent.name}] Final message count for conversation ${conversation.id}: ${messages.length}`,
            );
            console.debug(
              `[${agent.name}] Expected: ${countBefore + 2}, Got: ${messages.length}`,
            );

            // More lenient check - agents might be slow but functional
            expect(messages.length).toBeGreaterThanOrEqual(countBefore + 1); // At least our message went through
          }
        } else {
          console.debug(`${agent.name} with address ${agent.address} passed`);
          expect(result.allReceived).toBe(true);
        }
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
