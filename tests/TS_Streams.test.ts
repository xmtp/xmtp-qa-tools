import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { type Persona } from "../helpers/types";
import { verifyDMs } from "../helpers/verify";
import { getWorkers } from "../helpers/workers/creator";

/* 
TODO:
  - Percentge of missed?
  - Ensure streams recover correctly.
  - Handling repeated paralell dual streams.
  - Test different type of streams for users.
  - Timeout?
  - Installations
  - Multiple installations.
  - Multiple clients from the same installation.
*/

const env = "dev";
const testName = "TS_Streams_" + env;

describe(testName, () => {
  let bob: Persona;
  let joe: Persona;
  let elon: Persona;
  let alice: Persona;
  let fabri: Persona;
  let randompep: Persona;
  let personas: Persona[];
  beforeAll(async () => {
    const logger = createLogger(testName);
    overrideConsole(logger);
    personas = await getWorkers(
      ["bob", "joe", "elon", "fabri", "alice", "randompep"],
      "dev",
      testName,
    );
    [bob, joe, elon, fabri, alice, randompep] = personas;
    // Add delay to ensure streams are properly initialized
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    await flushLogger(testName);
    await Promise.all(
      personas.map(async (persona) => {
        await persona.worker?.terminate();
      }),
    );
  });

  it("test fabri sending gm to alice", async () => {
    const dmConvo = await fabri.client?.conversations.newDm(
      alice.client?.accountAddress as `0x${string}`,
    );
    if (!dmConvo) {
      throw new Error("DM conversation not found");
    }
    const result = await verifyDMs(dmConvo, [alice]);
    expect(result).toBe(true);
  }); // Increase timeout if needed

  it("test fabri sending gm to alice", async () => {
    const dmConvo = await fabri.client?.conversations.newDm(
      alice.client?.accountAddress as `0x${string}`,
    );
    if (!dmConvo) {
      throw new Error("DM conversation not found");
    }
    const result = await verifyDMs(dmConvo, [alice]);
    expect(result).toBe(true);
  }); // Increase timeout if needed

  it("test elon sending gm to fabri", async () => {
    const dmConvo = await elon.client?.conversations.newDm(
      fabri.client?.accountAddress as `0x${string}`,
    );
    if (!dmConvo) {
      throw new Error("DM conversation not found");
    }
    const result = await verifyDMs(dmConvo, [fabri]);
    expect(result).toBe(true);
  }); // Increase timeout if needed

  it("test bob sending gm to joe", async () => {
    const dmConvo = await bob.client?.conversations.newDm(
      joe.client?.accountAddress as `0x${string}`,
    );
    if (!dmConvo) {
      throw new Error("DM conversation not found");
    }
    const result = await verifyDMs(dmConvo, [joe]);
    expect(result).toBe(true);
  });

  it("should receive a group message in all streams", async () => {
    const newGroup = await bob.client!.conversations.newGroup([
      alice.client?.accountAddress as `0x${string}`,
      joe.client?.accountAddress as `0x${string}`,
      randompep.client?.accountAddress as `0x${string}`,
      elon.client?.accountAddress as `0x${string}`,
    ]);
    const result = await verifyDMs(newGroup, [joe, alice, randompep, elon]);
    expect(result).toBe(true);
  });
});
