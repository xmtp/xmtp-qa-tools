import { loadEnv } from "@helpers/client";
import {
  createDmConsentSender,
  createGroupConsentSender,
  verifyStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import {
  ConsentEntityType,
  ConsentState,
  type Conversation,
  type Group,
} from "@xmtp/node-sdk";
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

    // Use the helper function to create a consent sender
    const consentSender = createDmConsentSender(
      workers.get("henry")!,
      workers.get("randomguy")!.client.inboxId,
      initialConsentState,
    );

    // Use the specialized verifyStream function for consent events
    try {
      // Include both henry (sender) and randomguy (receiver) in participants
      const participants = [workers.get("henry")!, workers.get("randomguy")!];

      const verifyResult = await verifyStream(
        dmConversation,
        participants,
        typeofStream.Consent,
        1,
        (i, suffix) => `consent_update_${i}_${suffix}`,
        consentSender,
        () => {
          console.log("Consent update sent, starting timer now");
          start = performance.now();
        },
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
    } catch (e) {
      hasFailures = true;
      console.error("Test failed:", e);
      throw e;
    }
  });

  it("should manage consent for all members in a group", async () => {
    // Get addresses of all participants
    const participantAddresses = [
      workers.get("jack")?.client?.inboxId,
      workers.get("nancy")?.client?.inboxId,
      workers.get("oscar")?.client?.inboxId,
      workers.get("karen")?.client?.inboxId,
    ].filter(Boolean) as string[];

    console.log("Creating a group conversation...");
    const groupConversation = (await workers
      .get("henry")
      ?.client?.conversations.newGroup(participantAddresses)) as Group;

    // Verify the group was created successfully
    const members = await groupConversation?.members();
    console.log(`Group created with ${members?.length} members`);

    // Use the helper function to create a group consent sender
    const groupConsentSender = createGroupConsentSender(
      workers.get("henry")!,
      groupConversation.id,
      workers.get("jack")!.client.inboxId,
      true, // block the entities
    );

    // Set up participants for consent stream verification
    // Include all relevant participants
    const participants = [
      workers.get("henry")!, // Include initiator
      workers.get("jack")!,
      workers.get("nancy")!,
    ];

    // Use verifyStream with consent handling
    try {
      const verifyResult = await verifyStream(
        groupConversation,
        participants,
        typeofStream.Consent,
        1,
        (i, suffix) => `group_consent_update_${i}_${suffix}`,
        groupConsentSender,
        () => {
          console.log("Group consent update sent, starting timer now");
          start = performance.now();
        },
      );

      console.log("Group verify result:", JSON.stringify(verifyResult));

      // Verify the results
      expect(verifyResult.allReceived).toBe(true);

      // Verify group consent state
      const groupConsentState = await workers
        .get("henry")
        ?.client?.preferences.getConsentState(
          ConsentEntityType.GroupId,
          groupConversation?.id ?? "",
        );
      console.log(`Group consent state: ${groupConsentState}`);
      expect(groupConsentState).toBe(ConsentState.Denied);

      // Verify individual consent state
      const jackConsentState = await workers
        .get("henry")
        ?.client?.preferences.getConsentState(
          ConsentEntityType.InboxId,
          workers.get("jack")?.client?.inboxId ?? "",
        );
      console.log(`Jack's consent state: ${jackConsentState}`);
      expect(jackConsentState).toBe(ConsentState.Denied);

      // Test cleanup - unblock everyone by using the helper with blockEntities=false
      console.log("Unblocking all entities...");
      const unblockGroupSender = createGroupConsentSender(
        workers.get("henry")!,
        groupConversation.id,
        workers.get("jack")!.client.inboxId,
        false, // unblock the entities
      );

      await unblockGroupSender(groupConversation, "");

      // Final verification
      const finalGroupState = await workers
        .get("henry")
        ?.client?.preferences.getConsentState(
          ConsentEntityType.GroupId,
          groupConversation?.id ?? "",
        );
      console.log(`Final group consent state: ${finalGroupState}`);
      expect(finalGroupState).toBe(ConsentState.Allowed);
    } catch (e) {
      hasFailures = true;
      console.error("Test failed:", e);
      throw e;
    }
  });
});
