import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Dm } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "dms";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  const workers = await getWorkers([
    "henry",
    "ivy",
    "jack",
    "karen",
    "randomguy",
    "randomguy2",
    "larry",
    "mary",
    "nancy",
    "oscar",
  ]);

  let convo: Dm;

  it("newDm: should create a new DM conversation using inbox ID", async () => {
    convo = (await workers
      .get("henry")!
      .client.conversations.newDm(
        workers.get("randomguy")!.client.inboxId,
      )) as Dm;

    expect(convo).toBeDefined();
    expect(convo.id).toBeDefined();
  });
});
