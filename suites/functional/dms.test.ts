import { getWorkersWithVersions } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Dm } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "dms";

describe(testName, async () => {
  const workerDescriptors = getWorkersWithVersions([
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

  const workers = await getWorkers(
    workerDescriptors,
    testName,
    typeofStream.Message,
  );
  let convo: Dm;

  setupTestLifecycle({
    testName,
    expect,
  });

  it("should create a new DM conversation using inbox ID", async () => {
    try {
      convo = (await workers
        .get("henry")!
        .client.conversations.newDm(
          workers.get("randomguy")!.client.inboxId,
        )) as Dm;

      expect(convo).toBeDefined();
      expect(convo.id).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should create a new DM conversation using Ethereum address", async () => {
    try {
      const dm2 = await workers
        .get("henry")!
        .client.conversations.newDmWithIdentifier({
          identifier: workers.get("randomguy2")!.address,
          identifierKind: IdentifierKind.Ethereum,
        });

      expect(dm2).toBeDefined();
      expect(dm2.id).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it("should send a message in DM conversation", async () => {
    try {
      const message = "gm-" + Math.random().toString(36).substring(2, 15);

      console.log(
        `[${workers.get("henry")?.name}] Creating DM with ${workers.get("randomguy")?.name} at ${workers.get("randomguy")?.client.inboxId}`,
      );

      const dmId = await convo.send(message);

      expect(dmId).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should receive and verify message delivery in DM conversation", async () => {
    try {
      const verifyResult = await verifyMessageStream(convo, [
        workers.get("randomguy")!,
      ]);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("fail on purssspos2e", () => {
    expect(false).toBe(true);
  });

  it("faild on sdds", () => {
    expect(false).toBe(true);
  });

  it("faidl on faa", () => {
    expect(false).toBe(true);
  });
});
