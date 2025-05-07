import { loadEnv } from "@helpers/client";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { ConsentEntityType, ConsentState } from "@xmtp/node-sdk";
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

    const consentPromise = workers
      .get("henry")
      ?.worker?.collectConsentUpdates();

    const getConsentState = await workers
      .get("henry")
      ?.client?.preferences.getConsentState(
        ConsentEntityType.InboxId,
        workers.get("randomguy")?.client?.inboxId ?? "",
      );
    console.log("Consent state:", getConsentState);

    // Alice blocks Bob
    console.log(`Alice is ${getConsentState ? "blocking" : "allowing"} Bob...`);
    await workers.get("henry")?.client?.preferences.setConsentStates([
      {
        entity: workers.get("randomguy")?.client?.inboxId ?? "",
        entityType: ConsentEntityType.InboxId,
        state:
          getConsentState === ConsentState.Allowed
            ? ConsentState.Denied
            : ConsentState.Allowed,
      },
    ]);

    const getConsentStateUpdated = await workers
      .get("henry")
      ?.client?.preferences.getConsentState(
        ConsentEntityType.InboxId,
        workers.get("randomguy")?.client?.inboxId ?? "",
      );

    // Wait for the consent update to be received
    const consentUpdates = await consentPromise;
    console.log("Consent updates:", consentUpdates?.length);

    expect(consentUpdates).toBeDefined();
    expect(getConsentStateUpdated).toBeDefined();
    expect(getConsentStateUpdated).not.toEqual(getConsentState);
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
    const groupConversation = await workers
      .get("henry")
      ?.client?.conversations.newGroup(participantAddresses);

    // Verify the group was created successfully
    const members = await groupConversation?.members();
    console.log(`Group created with ${members?.length} members`);

    // Set up consent streams for all members to listen for updates
    const consentPromise = workers
      .get("henry")
      ?.worker?.collectConsentUpdates();

    // Alice blocks the entire group
    console.log("Alice is blocking the group...");
    await workers.get("henry")?.client?.preferences.setConsentStates([
      {
        entity: groupConversation?.id ?? "",
        entityType: ConsentEntityType.GroupId,
        state: ConsentState.Denied,
      },
    ]);

    // Verify Alice's consent state for the group
    const groupConsentState = await workers
      .get("henry")
      ?.client?.preferences.getConsentState(
        ConsentEntityType.GroupId,
        groupConversation?.id ?? "",
      );
    console.log(`Alice's consent state for the group: ${groupConsentState}`);

    console.log("Testing individual member consent states...");

    // Alice blocks Bob specifically
    await workers.get("henry")?.client?.preferences.setConsentStates([
      {
        entity: workers.get("jack")?.client?.inboxId as string,
        entityType: ConsentEntityType.InboxId,
        state: ConsentState.Denied,
      },
    ]);

    const bobConsentState = await workers
      .get("henry")
      ?.client?.preferences.getConsentState(
        ConsentEntityType.InboxId,
        workers.get("jack")?.client?.inboxId ?? "",
      );
    console.log(
      `Alice's consent state for Bob is : ${
        bobConsentState == ConsentState.Allowed
          ? "allowed"
          : bobConsentState == ConsentState.Denied
            ? "denied"
            : "unknown"
      }`,
    );

    // Collect all consent updates
    const allConsentUpdates = await consentPromise;
    console.log("All consent updates received:", allConsentUpdates?.length);

    // Unblock everyone
    console.log("Unblocking all entities...");
    await workers.get("henry")?.client?.preferences.setConsentStates([
      {
        entity: groupConversation?.id ?? "",
        entityType: ConsentEntityType.GroupId,
        state: ConsentState.Allowed,
      },
      {
        entity: workers.get("jack")?.client?.inboxId as string,
        entityType: ConsentEntityType.InboxId,
        state: ConsentState.Allowed,
      },
    ]);

    // Final verification
    const finalGroupState = await workers
      .get("henry")
      ?.client?.preferences.getConsentState(
        ConsentEntityType.GroupId,
        groupConversation?.id ?? "",
      );
    console.log(`Final group consent state: ${finalGroupState}`);
    expect(finalGroupState).toBe(ConsentState.Allowed);
  });
});
