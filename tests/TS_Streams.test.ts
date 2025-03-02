import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeEnv, loadEnv } from "../helpers/client";
import {
  ConsentEntityType,
  ConsentState,
  type Conversation,
  type Persona,
} from "../helpers/types";
import { verifyGroupConversationStream, verifyStream } from "../helpers/verify";
import { getWorkers } from "../helpers/workers/factory";

const testName = "TS_Streams";
await loadEnv(testName);
let personas: Record<string, Persona>;

describe(testName, () => {
  beforeAll(async () => {
    personas = await getWorkers(
      ["bob", "joe", "elon", "fabri", "alice"],
      testName,
    );
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  it("test fabri sending gm to alice", async () => {
    const dmConvo = await personas.fabri.client?.conversations.newDm(
      personas.alice.client?.accountAddress as `0x${string}`,
    );
    if (!dmConvo) {
      throw new Error("DM conversation not found");
    }
    const result = await verifyStream(dmConvo, [personas.alice]);
    expect(result.allReceived).toBe(true);
  }); // Increase timeout if needed

  it("test fabri sending gm to alice", async () => {
    const dmConvo = await personas.fabri.client?.conversations.newDm(
      personas.alice.client?.accountAddress as `0x${string}`,
    );
    if (!dmConvo) {
      throw new Error("DM conversation not found");
    }
    const result = await verifyStream(dmConvo, [personas.alice]);
    expect(result.allReceived).toBe(true);
  }); // Increase timeout if needed

  it("test elon sending gm to fabri", async () => {
    const dmConvo = await personas.elon.client?.conversations.newDm(
      personas.fabri.client?.accountAddress as `0x${string}`,
    );
    if (!dmConvo) {
      throw new Error("DM conversation not found");
    }
    const result = await verifyStream(dmConvo, [personas.fabri]);
    expect(result.allReceived).toBe(true);
  }); // Increase timeout if needed

  it("test bob sending gm to joe", async () => {
    const dmConvo = await personas.bob.client?.conversations.newDm(
      personas.joe.client?.accountAddress as `0x${string}`,
    );
    if (!dmConvo) {
      throw new Error("DM conversation not found");
    }
    const result = await verifyStream(dmConvo, [personas.joe]);
    expect(result.allReceived).toBe(true);
  });

  it("should receive a group message in all streams", async () => {
    const newGroup = await personas.bob.client!.conversations.newGroup(
      Object.values(personas).map(
        (p) => p.client?.accountAddress as `0x${string}`,
      ),
    );
    const members = await newGroup.members();
    for (const member of members) {
      const worker = Object.values(personas).find(
        (w) => w.client!.inboxId === member.inboxId,
      );
      console.log(
        "name:",
        worker?.name,
        "installations:",
        member.installationIds.length,
      );
    }
    const result = await verifyStream(newGroup, [
      personas.bob,
      personas.joe,
      personas.elon,
      personas.fabri,
    ]);
    expect(result.allReceived).toBe(true);
  });
});

describe(testName, () => {
  let groupCreator: (
    initiator: Persona,
    participantAddresses: string[],
  ) => Promise<Conversation>;

  beforeAll(async () => {
    groupCreator = async (
      initiator: Persona,
      participantAddresses: string[],
    ) => {
      if (!initiator.client) {
        throw new Error("Initiator has no client");
      }
      return initiator.client.conversations.newGroup(participantAddresses);
    };
    personas = await getWorkers(
      ["bob", "joe", "elon", "fabri", "alice"],
      testName,
      "conversation",
    );
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });
  it("detects new group conversation creation with three participants", async () => {
    const initiator = personas.alice;
    const participants = [personas.bob, personas.joe];

    await verifyGroupConversationStream(initiator, participants, groupCreator);
  });

  it("detects new group conversation with all available personas", async () => {
    const initiator = personas.fabri;
    const participants = [
      personas.alice,
      personas.bob,
      personas.joe,
      personas.elon,
    ];

    await verifyGroupConversationStream(initiator, participants, groupCreator);
  });
});

describe(testName, () => {
  beforeAll(async () => {
    personas = await getWorkers(
      ["alice", "bob", "charlie", "dave", "eve", "random"],
      testName,
      "consent",
    );
  });
  afterAll(async () => {
    await closeEnv(testName, personas);
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
