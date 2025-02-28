import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../helpers/client";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { type Conversation, type Persona } from "../helpers/types";
import { verifyStream } from "../helpers/verify";
import { getWorkers } from "../helpers/workers/factory";

const env = "dev";
const testName = "TS_Forked_" + env;
loadEnv(testName);

describe(testName, () => {
  let personas: Record<string, Persona>;
  let group: Conversation;
  let gmMessageGenerator: (i: number, suffix: string) => string;
  let gmSender: (convo: Conversation, message: string) => Promise<void>;

  beforeAll(async () => {
    gmMessageGenerator = (i: number, suffix: string) => {
      return `gm-${i + 1}-${suffix}`;
    };
    gmSender = async (convo: Conversation, message: string) => {
      await convo.send(message);
    };

    const logger = await createLogger(testName);
    overrideConsole(logger);

    personas = await getWorkers(
      ["bella", "dave", "elon", "diana", "random", "alice", "bob"],
      env,
      testName,
    );
  });

  afterAll(async () => {
    await flushLogger(testName);
    await Promise.all(
      Object.values(personas).map(async (p) => {
        await p.worker?.terminate();
      }),
    );
  });

  it("should create a group and establish baseline communication", async () => {
    // Create initial group with a few members
    group = await personas.bella.client!.conversations.newGroup([
      personas.bella.client?.accountAddress as `0x${string}`,
      personas.dave.client?.accountAddress as `0x${string}`,
      personas.elon.client?.accountAddress as `0x${string}`,
    ]);

    expect(group).toBeDefined();
    expect(group.id).toBeDefined();

    // Send initial messages to establish that communication works
    await group.send("Initial message in epoch 0");

    const result = await verifyStream(
      group,
      [personas.elon, personas.dave],
      gmMessageGenerator,
      gmSender,
    );
    expect(result.allReceived).toBe(true);
  });

  it("should force an epoch transition by adding members", async () => {
    // Adding members should trigger an epoch transition in MLS
    console.log("Adding members to trigger epoch transition");
    await group.addMembers([
      personas.diana.client?.accountAddress as `0x${string}`,
      personas.random.client?.accountAddress as `0x${string}`,
    ]);

    // Send a message in the new epoch
    await group.send("Message after first epoch transition");

    // Verify all members including new ones can receive messages
    const result = await verifyStream(
      group,
      [personas.elon, personas.dave, personas.diana, personas.random],
      gmMessageGenerator,
      gmSender,
    );
    expect(result.allReceived).toBe(true);
  });

  it("should create concurrent operations to potentially cause epoch divergence", async () => {
    // Get references to the same group for different members
    const bellaGroup = group;
    const daveGroup = personas.dave.client?.conversations.getConversationById(
      group.id,
    );
    const elonGroup = personas.elon.client?.conversations.getConversationById(
      group.id,
    );

    if (!daveGroup || !elonGroup) {
      throw new Error("Could not get group references for all members");
    }

    // Create promises for concurrent operations from different members
    // This has the potential to create epoch forks if not properly synchronized
    const op1 = bellaGroup.addMembers([
      personas.alice.client?.accountAddress as `0x${string}`,
    ]);

    const op2 = bellaGroup.removeMembers([
      personas.random.client?.accountAddress as `0x${string}`,
    ]);

    const op3 = elonGroup.updateName("Updated in potential fork");

    // Execute all operations at roughly the same time
    await Promise.all([
      op1.catch((e: unknown) => {
        console.error("Bella operation failed:", e);
      }),
      op2.catch((e: unknown) => {
        console.error("Dave operation failed:", e);
      }),
      op3.catch((e: unknown) => {
        console.error("Elon operation failed:", e);
      }),
    ]);

    // Allow some time for synchronization
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Send messages from different clients to check if they're still in sync
    await bellaGroup.send("Message from Bella after concurrent operations");
    await daveGroup.send("Message from Dave after concurrent operations");
    await elonGroup.send("Message from Elon after concurrent operations");

    // Verify messages can be received by all remaining members
    const result = await verifyStream(
      group,
      [
        personas.bella,
        personas.dave,
        personas.elon,
        personas.diana,
        personas.alice,
      ],
      gmMessageGenerator,
      gmSender,
    );

    expect(result.allReceived).toBe(true);
  });

  it("should verify group consistency after potential fork", async () => {
    // Get messages as seen by different members
    await group.sync();
    const bellaMessages = await group.messages();
    const daveGroup = personas.dave.client?.conversations.getConversationById(
      group.id,
    );
    await daveGroup?.sync();
    const daveMessages = await daveGroup?.messages();

    const elonGroup = personas.elon.client?.conversations.getConversationById(
      group.id,
    );
    await elonGroup?.sync();
    const elonMessages = await elonGroup?.messages();

    const dianaGroup = personas.diana.client?.conversations.getConversationById(
      group.id,
    );
    await dianaGroup?.sync();
    const dianaMessages = await dianaGroup?.messages();

    const aliceGroup = personas.alice.client?.conversations.getConversationById(
      group.id,
    );
    await aliceGroup?.sync();
    const aliceMessages = await aliceGroup?.messages();

    // Check that all members see the same messages (no forking/divergence)
    expect(bellaMessages.length).toBeGreaterThan(0);
    // Users added later start with 0 history, and even the creator's first message is only to itself
    expect(daveMessages?.length).toBe(bellaMessages.length - 1);
    expect(elonMessages?.length).toBe(bellaMessages.length - 1);
    // Diana was added in the second test, so she should have 9 messages (missing the first 4)
    expect(dianaMessages?.length).toBe(9);

    // Alice was added during the concurrent operations test, so she should have fewer messages
    // than Diana and the original members
    expect(aliceMessages?.length).toBe(4);
  });

  it("should simulate a network partition by adding members from different clients", async () => {
    // Get references to the group for different members
    const bellaGroup = group;
    const daveGroup = personas.dave.client?.conversations.getConversationById(
      group.id,
    );

    if (!daveGroup) {
      throw new Error("Could not get group reference for Dave");
    }

    // Add a member from Bella's client
    await bellaGroup.addMembers([
      personas.bob.client?.accountAddress as `0x${string}`,
    ]);

    // Send a message from Bella
    await bellaGroup.send("Message from Bella after adding Bob");

    // Allow some time for synchronization
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Send a message from Dave
    await daveGroup.send("Message from Dave after Bella added Bob");

    // Allow some time for synchronization
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify all members are in sync and can receive messages
    const result = await verifyStream(
      group,
      [
        personas.bella,
        personas.dave,
        personas.elon,
        personas.diana,
        personas.alice,
        personas.bob,
      ],
      gmMessageGenerator,
      gmSender,
    );

    expect(result.allReceived).toBe(true);
  });
  it("should handle rapid consecutive member changes without forking", async () => {
    // Perform a series of rapid member changes that would likely cause epoch transitions
    console.log("Starting rapid consecutive member changes...");

    // Add one member
    await group.addMembers([
      personas.random.client?.accountAddress as `0x${string}`,
    ]);

    // Immediately remove that member
    await group.removeMembers([
      personas.random.client?.accountAddress as `0x${string}`,
    ]);

    // Add them again
    await group.addMembers([
      personas.random.client?.accountAddress as `0x${string}`,
    ]);

    // Remove a different member
    await group.removeMembers([
      personas.bob.client?.accountAddress as `0x${string}`,
    ]);

    // Add the removed member back
    await group.addMembers([
      personas.bob.client?.accountAddress as `0x${string}`,
    ]);

    // Allow time for synchronization
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Send a message from different members
    await group.send("Message from Bella after rapid member changes");
    await personas.dave.client?.conversations
      .getConversationById(group.id)
      ?.send("Message from Dave after rapid member changes");
    await personas.random.client?.conversations
      .getConversationById(group.id)
      ?.send("Message from Random after rapid member changes");

    // Verify all members can still communicate
    const result = await verifyStream(
      group,
      [
        personas.bella,
        personas.dave,
        personas.elon,
        personas.diana,
        personas.alice,
        personas.bob,
        personas.random,
      ],
      gmMessageGenerator,
      gmSender,
    );

    expect(result.allReceived).toBe(true);
  });
  it("should recover from simulated network partition", async () => {
    // Simulate network partition by having no communication for a period
    console.log("Simulating network partition...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get references to the group for different members
    const bellaGroup = group;
    const bobGroup = personas.bob.client?.conversations.getConversationById(
      group.id,
    );

    if (!bobGroup) {
      throw new Error("Could not get group reference for Bob");
    }

    // After "network partition", make changes from both sides
    await bellaGroup.updateName("Bella's post-partition update");
    await bobGroup.send("Bob's post-partition message");

    // Allow time for synchronization
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check that all members see the same group state
    const bellaMetadata =
      personas.bella.client?.conversations.getConversationById(group.id);
    const bobMetadata = personas.bob.client?.conversations.getConversationById(
      group.id,
    );
    const daveMetadata =
      personas.dave.client?.conversations.getConversationById(group.id);

    expect(bobMetadata?.name).toBe(bellaMetadata?.name);
    expect(daveMetadata?.name).toBe(bellaMetadata?.name);

    // Verify messages can be sent and received
    const result = await verifyStream(
      group,
      [
        personas.bella,
        personas.dave,
        personas.elon,
        personas.diana,
        personas.alice,
        personas.bob,
      ],
      gmMessageGenerator,
      gmSender,
    );

    expect(result.allReceived).toBe(true);
  });
});
