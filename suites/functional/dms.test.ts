import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Dm } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "dms";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  const workers = await getWorkers(
    [
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
    ],
    { useVersions: true },
  );

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

  it("newDmWithIdentifier should create a new DM conversation using Ethereum address", async () => {
    const dm2 = await workers
      .get("henry")!
      .client.conversations.newDmWithIdentifier({
        identifier: workers.get("randomguy2")!.address,
        identifierKind: IdentifierKind.Ethereum,
      });

    expect(dm2).toBeDefined();
    expect(dm2.id).toBeDefined();
  });
  it("should send a message in DM conversation", async () => {
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    console.log(
      `[${workers.get("henry")?.name}] Creating DM with ${workers.get("randomguy")?.name} at ${workers.get("randomguy")?.client.inboxId}`,
    );

    const dmId = await convo.send(message);

    expect(dmId).toBeDefined();
  });

  it("should receive and verify message delivery in DM conversation", async () => {
    const verifyResult = await verifyMessageStream(convo, [
      workers.get("randomguy")!,
    ]);
    expect(verifyResult.allReceived).toBe(true);
  });

  it("fail on purpose1", () => {
    throw new Error("fail on purpose");
  });
  it("fail on purpose2", () => {
    throw new Error("fail on purpose");
  });
  it("fail on purpose3", () => {
    throw new Error("fail on purpose");
  });
  it("fail on purpose4", () => {
    throw new Error("fail on purpose");
  });
  it("fail on purpose5", () => {
    throw new Error("fail on purpose");
  });
  it("fail on purpose6", () => {
    throw new Error("fail on purpose");
  });
  it("fail on purpose7", () => {
    throw new Error("fail on purpose");
  });
});
