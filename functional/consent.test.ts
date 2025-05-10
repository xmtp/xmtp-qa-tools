import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import {
  createGroupConsentSender,
  verifyConsentStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { ConsentEntityType } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "consent";
loadEnv(testName);

describe(testName, async () => {
  let workers: WorkerManager;

  let start: number;
  let testStart: number;

  workers = await getWorkers(
    [
      "henry",
      "ivy",
      "jack",
      "karen",
      "randomguy",
      "larry",
      "mary",
      "nancy",
      "oscar",
    ],
    testName,
    typeofStream.Consent,
  );

  setupTestLifecycle({
    expect,
    workers,
    testName,
    getStart: () => start,
    setStart: (v) => {
      start = v;
    },
    getTestStart: () => testStart,
    setTestStart: (v) => {
      testStart = v;
    },
  });

  it("should stream consent updates when a user is blocked", async () => {
    try {
      console.log(
        "Creating DM conversation with address:",
        workers.get("randomguy")?.client?.inboxId,
      );
      const dmConversation = await workers
        .get("henry")
        ?.client?.conversations.newDm(
          workers.get("randomguy")?.client?.inboxId ?? "",
        );

      if (!dmConversation) {
        throw new Error("DM conversation not created");
      }

      // Get initial consent state to compare later
      const initialConsentState = await workers
        .get("henry")
        ?.client?.preferences.getConsentState(
          ConsentEntityType.InboxId,
          workers.get("randomguy")?.client?.inboxId ?? "",
        );
      console.log("Initial consent state:", initialConsentState);

      const groupConsentSender = createGroupConsentSender(
        workers.get("henry")!, // henry is doing the consent update
        dmConversation.id, // for this group
        workers.get("randomguy")!.client.inboxId, // blocking randomguy
        true, // block the entities
      );

      const consentAction = async () => {
        await groupConsentSender();
      };

      console.log("Starting consent verification process");

      const verifyResult = await verifyConsentStream(
        workers.get("henry")!,
        [workers.get("randomguy")!],
        consentAction,
      );

      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
