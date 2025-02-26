import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  ConsentEntityType,
  ConsentState,
  type Persona,
  type XmtpEnv,
} from "../helpers/types";
import { getWorkers } from "../helpers/workers/factory";

dotenv.config();

const env: XmtpEnv = "dev";
const testName = "TS_Consent_" + env;

describe(testName, () => {
  let personas: Record<string, Persona>;

  beforeAll(async () => {
    const logger = await createLogger(testName);
    overrideConsole(logger);
    personas = await getWorkers(
      ["alice", "bob", "charlie", "dave", "eve", "random"],
      env,
      testName,
      "consent",
    );
  });

  afterAll(async () => {
    await flushLogger(testName);
    await Promise.all(
      Object.values(personas).map(async (persona) => {
        await persona.worker?.terminate();
      }),
    );
  });

  it("should stream consent updates when a user is blocked", async () => {
    console.log(
      "Creating DM conversation with address:",
      personas.random.client?.accountAddress,
    );
    const dmConversation = await personas.alice.client?.conversations.newDm(
      personas.random.client?.accountAddress ?? "",
    );

    if (!dmConversation) {
      throw new Error("DM conversation not created");
    }

    console.time("setup-consent-stream");
    // Set up Bob's worker to collect consent updates
    const consentPromise = personas.alice.worker?.collectConsentUpdates();
    console.timeEnd("setup-consent-stream");

    console.time("get-initial-consent");
    const getConsentState = await personas.alice.client?.getConsentState(
      ConsentEntityType.Address,
      personas.random.client?.accountAddress ?? "",
    );
    console.log("Consent state:", getConsentState);
    console.timeEnd("get-initial-consent");

    console.time("set-consent-state");
    // Alice blocks Bob
    console.log(`Alice is ${getConsentState ? "blocking" : "allowing"} Bob...`);
    await personas.alice.client?.setConsentStates([
      {
        entity: personas.random.client?.accountAddress ?? "",
        entityType: ConsentEntityType.Address,
        state:
          getConsentState === ConsentState.Allowed
            ? ConsentState.Denied
            : ConsentState.Allowed,
      },
    ]);
    console.timeEnd("set-consent-state");

    console.time("get-updated-consent");
    const getConsentStateUpdated = await personas.alice.client?.getConsentState(
      ConsentEntityType.Address,
      personas.random.client?.accountAddress ?? "",
    );
    console.timeEnd("get-updated-consent");

    console.time("wait-for-consent-updates");
    // Wait for the consent update to be received
    const consentUpdates = await consentPromise;
    console.log("Consent updates:", consentUpdates);

    expect(consentUpdates).toBeDefined();
    expect(getConsentStateUpdated).toBeDefined();
    expect(getConsentStateUpdated).not.toEqual(getConsentState);
  });

  it("should manage consent for all members in a group", async () => {
    // Get addresses of all participants
    const participantAddresses = [
      personas.bob.client?.accountAddress,
      personas.charlie.client?.accountAddress,
      personas.dave.client?.accountAddress,
      personas.eve.client?.accountAddress,
    ].filter(Boolean) as string[];

    console.time("create-group");
    console.log("Creating a group conversation...");
    const groupConversation =
      await personas.alice.client?.conversations.newGroup(participantAddresses);
    console.timeEnd("create-group");

    console.time("get-members");
    // Verify the group was created successfully
    const members = await groupConversation?.members();
    console.log(`Group created with ${members?.length} members`);
    console.timeEnd("get-members");

    // Set up consent streams for all members to listen for updates
    const consentPromise = personas.alice.worker?.collectConsentUpdates();

    console.time("block-group");
    // Alice blocks the entire group
    console.log("Alice is blocking the group...");
    await personas.alice.client?.setConsentStates([
      {
        entity: groupConversation?.id ?? "",
        entityType: ConsentEntityType.GroupId,
        state: ConsentState.Denied,
      },
    ]);
    console.timeEnd("block-group");

    console.time("get-group-consent");
    // Verify Alice's consent state for the group
    const groupConsentState = await personas.alice.client?.getConsentState(
      ConsentEntityType.GroupId,
      groupConversation?.id ?? "",
    );
    console.log(`Alice's consent state for the group: ${groupConsentState}`);
    console.timeEnd("get-group-consent");

    console.log("Testing individual member consent states...");

    console.time("block-bob");
    // Alice blocks Bob specifically
    await personas.alice.client?.setConsentStates([
      {
        entity: personas.bob.client?.accountAddress as string,
        entityType: ConsentEntityType.Address,
        state: ConsentState.Denied,
      },
    ]);
    console.timeEnd("block-bob");

    console.time("get-bob-consent");
    // Verify Bob's consent state
    const bobConsentState = await personas.alice.client?.getConsentState(
      ConsentEntityType.Address,
      personas.bob.client?.accountAddress ?? "",
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
    await personas.alice.client?.setConsentStates([
      {
        entity: groupConversation?.id ?? "",
        entityType: ConsentEntityType.GroupId,
        state: ConsentState.Allowed,
      },
      {
        entity: personas.bob.client?.accountAddress as string,
        entityType: ConsentEntityType.Address,
        state: ConsentState.Allowed,
      },
    ]);
    console.timeEnd("unblock-all");

    console.time("get-final-state");
    // Final verification
    const finalGroupState = await personas.alice.client?.getConsentState(
      ConsentEntityType.GroupId,
      groupConversation?.id ?? "",
    );
    console.log(`Final group consent state: ${finalGroupState}`);
    expect(finalGroupState).toBe(ConsentState.Allowed);
    console.timeEnd("get-final-state");
  });
});
