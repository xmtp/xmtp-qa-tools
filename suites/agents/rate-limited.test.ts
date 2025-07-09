import { verifyBotMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream, typeOfSync } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "rate-limited";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  const workers = await getWorkers(8);
  // Start message and response streams for rate limiting test
  workers.startStream(typeofStream.MessageandResponse);
  workers.getAll().forEach((worker) => {
    worker.worker.startSync(typeOfSync.Both);
  });

  let targetInboxId: string = "0x194c31cae1418d5256e8c58e0d08aee1046c6ed0";

  // Handle case where no agents are configured for the current environment

  it("should send high-volume parallel messages from multiple worker threads to test rate limiting", async () => {
    const conversation = (await workers
      .getCreator()
      .client.conversations.newDmWithIdentifier({
        identifier: targetInboxId,
        identifierKind: IdentifierKind.Ethereum,
      })) as unknown as Group;

    const result = await verifyBotMessageStream(
      conversation,
      [workers.getCreator()],
      "hi",
      3, // maxRetries
    );
    expect(result).toBe(true);
  });
});
