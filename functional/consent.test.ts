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

    console.time("setup-consent-stream");
    const consentPromise = workers
      .get("henry")
      ?.worker?.collectConsentUpdates();
    console.timeEnd("setup-consent-stream");

    console.time("get-initial-consent");
    const getConsentState = await workers
      .get("henry")
      ?.client?.preferences.getConsentState(
        ConsentEntityType.InboxId,
        workers.get("randomguy")?.client?.inboxId ?? "",
      );
    console.log("Consent state:", getConsentState);
    console.timeEnd("get-initial-consent");

    console.time("set-consent-state");
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
    console.timeEnd("set-consent-state");

    console.time("get-updated-consent");
    const getConsentStateUpdated = await workers
      .get("henry")
      ?.client?.preferences.getConsentState(
        ConsentEntityType.InboxId,
        workers.get("randomguy")?.client?.inboxId ?? "",
      );
    console.timeEnd("get-updated-consent");

    console.time("wait-for-consent-updates");
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

    console.time("create-group");
    console.log("Creating a group conversation...");
    const groupConversation = await workers
      .get("henry")
      ?.client?.conversations.newGroup(participantAddresses);
    console.timeEnd("create-group");

    console.time("get-members");
    // Verify the group was created successfully
    const members = await groupConversation?.members();
    console.log(`Group created with ${members?.length} members`);
    console.timeEnd("get-members");

    // Set up consent streams for all members to listen for updates
    const consentPromise = workers
      .get("henry")
      ?.worker?.collectConsentUpdates();

    console.time("block-group");
    // Alice blocks the entire group
    console.log("Alice is blocking the group...");
    await workers.get("henry")?.client?.preferences.setConsentStates([
      {
        entity: groupConversation?.id ?? "",
        entityType: ConsentEntityType.GroupId,
        state: ConsentState.Denied,
      },
    ]);
    console.timeEnd("block-group");

    console.time("get-group-consent");
    // Verify Alice's consent state for the group
    const groupConsentState = await workers
      .get("henry")
      ?.client?.preferences.getConsentState(
        ConsentEntityType.GroupId,
        groupConversation?.id ?? "",
      );
    console.log(`Alice's consent state for the group: ${groupConsentState}`);
    console.timeEnd("get-group-consent");

    console.log("Testing individual member consent states...");

    console.time("block-bob");
    // Alice blocks Bob specifically
    await workers.get("henry")?.client?.preferences.setConsentStates([
      {
        entity: workers.get("jack")?.client?.inboxId as string,
        entityType: ConsentEntityType.InboxId,
        state: ConsentState.Denied,
      },
    ]);
    console.timeEnd("block-bob");

    console.time("get-bob-consent");
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
    console.timeEnd("get-bob-consent");

    console.time("collect-all-updates");
    // Collect all consent updates
    const allConsentUpdates = await consentPromise;
    console.log("All consent updates received:", allConsentUpdates?.length);
    console.timeEnd("collect-all-updates");

    console.time("unblock-all");
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
    console.timeEnd("unblock-all");

    console.time("get-final-state");
    // Final verification
    const finalGroupState = await workers
      .get("henry")
      ?.client?.preferences.getConsentState(
        ConsentEntityType.GroupId,
        groupConversation?.id ?? "",
      );
    console.log(`Final group consent state: ${finalGroupState}`);
    expect(finalGroupState).toBe(ConsentState.Allowed);
    console.timeEnd("get-final-state");
  });
});
