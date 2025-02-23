import { beforeAll, describe, expect, it } from "vitest";
import { createLogger, overrideConsole } from "../helpers/logger";
import { PersonaFactory, type Persona } from "../helpers/personas";

const timeout = 10000;
const testName = "gm";
const env = "production";
const logger = createLogger(testName);
const personaFactory = new PersonaFactory(env, testName);
overrideConsole(logger);
describe("Test for different GM flows", () => {
  let bob: Persona;
  let joe: Persona;
  let alice: Persona;
  let fabri: Persona;
  let elon: Persona;
  beforeAll(async () => {
    [bob, joe, alice, fabri, elon] = await personaFactory.getPersonas([
      "bob",
      "joe",
      "alice",
      "fabri",
      "elon",
    ]);
    console.log("bob.worker", bob.worker?.name);
    console.log("joe.worker", joe.worker?.name);
    console.log("alice.worker", alice.worker?.name);
    console.log("fabri.worker", fabri.worker?.name);
    console.log("elon.worker", elon.worker?.name);
  }, timeout * 3);
  it(
    "should joe to bob",
    async () => {
      const result = await testMessageFromTo(joe, bob);
      expect(result).toBe(true);
    },
    timeout,
  );
  it(
    "should bob to joe",
    async () => {
      const result = await testMessageFromTo(bob, joe);
      expect(result).toBe(true);
    },
    timeout,
  );

  // it(
  //   "should alice to fabri",
  //   async () => {
  //     const result = await testMessageFromTo(alice, fabri);
  //     expect(result).toBe(true);
  //   },
  //   timeout,
  // );
  // it(
  //   "should elon to bob",
  //   async () => {
  //     const result = await testMessageFromTo(elon, bob);
  //     expect(result).toBe(true);
  //   },
  //   timeout,
  // );
  // it(
  //   "should elon to alice",
  //   async () => {
  //     const result = await testMessageFromTo(elon, alice);
  //     expect(result).toBe(true);
  //   },
  //   timeout,
  // );
  // it(
  //   "should elon to fabri",
  //   async () => {
  //     const result = await testMessageFromTo(elon, fabri);
  //     expect(result).toBe(true);
  //   },
  //   timeout,
  // );
  // it(
  //   "should alice to joe",
  //   async () => {
  //     const result = await testMessageFromTo(alice, joe);
  //     expect(result).toBe(true);
  //   },
  //   timeout,
  // );
  // it(
  //   "should measure creating a group",
  //   async () => {
  //     const [fabri, elon] = personas;
  //     const groupId = await fabri.worker!.createGroup([
  //       elon.address,
  //       fabri.address,
  //     ]);
  //     const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

  //     const elonPromise = elon.worker!.receiveMessage(groupId, groupMessage);

  //     await fabri.worker!.sendMessage(groupId, groupMessage);

  //     await elonPromise;
  //   },
  //   defaultValues.timeout,
  // );
});

async function testMessageFromTo(sender: Persona, receiver: Persona) {
  const groupId = await sender.worker!.createDM(receiver.address);
  console.log("groupId", groupId);

  const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

  const receiverPromise = receiver.worker!.receiveMessage(groupMessage);

  await sender.worker!.sendMessage(groupId, groupMessage);
  const message = await receiverPromise;
  return message === groupMessage;
}
