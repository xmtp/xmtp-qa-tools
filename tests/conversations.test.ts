import { closeEnv, loadEnv } from "@helpers/client";
import { type Conversation, type Persona } from "@helpers/types";
import { verifyGroupConversationStream } from "@helpers/verify";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, it } from "vitest";

const testName = "conversations";
loadEnv(testName);

describe(testName, () => {
  let personas: Record<string, Persona>;
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
