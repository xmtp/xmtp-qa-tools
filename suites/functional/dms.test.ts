import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Dm } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "dms";
loadEnv(testName);

describe(testName, async () => {
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
    testName,
    typeofStream.Message,
  );
  let convo: Dm;

  setupTestLifecycle({
    expect,
  });

  it("newDm: should measure creating a DM", async () => {
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

  it("newDmWithIdentifiers: should measure creating a DM", async () => {
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
  it("sendGM: should measure sending a gm", async () => {
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

  it("receiveGM: should measure receiving a gm", async () => {
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
});
