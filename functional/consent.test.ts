import { loadEnv } from "@helpers/client";
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
  let hasFailures: boolean = false;
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
    hasFailuresRef: hasFailures,
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
      await groupConsentSender(dmConversation, "consent");
    };

    console.log("Starting consent verification process");

    const verifyResult = await verifyConsentStream(
      workers.get("henry")!,
      [workers.get("randomguy")!],
      consentAction,
    );

    console.log("Verify result:", JSON.stringify(verifyResult));

    // Verify the results - our specialized implementation should ensure allReceived is true
    expect(verifyResult.allReceived).toBe(true);

    // Verify the consent state changed
    const updatedConsentState = await workers
      .get("henry")
      ?.client?.preferences.getConsentState(
        ConsentEntityType.InboxId,
        workers.get("randomguy")?.client?.inboxId ?? "",
      );

    expect(updatedConsentState).toBeDefined();
    expect(updatedConsentState).not.toEqual(initialConsentState);
  });
});
