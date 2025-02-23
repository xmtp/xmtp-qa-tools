import { beforeAll, describe, expect, it } from "vitest";
import { createLogger, overrideConsole } from "../helpers/logger";
import {
  defaultValues,
  PersonaFactory,
  type Persona,
} from "../helpers/personas";

const testName = "gm";
const env = "dev";
const logger = createLogger(testName);
const personaFactory = new PersonaFactory(env, testName);
overrideConsole(logger);
describe("Test for different GM flows", () => {
  let bob: Persona;
  let joe: Persona;
  beforeAll(async () => {
    [bob, joe] = await personaFactory.getPersonas(["bob", "joe"]);
    console.log("bob.worker", bob.worker?.name);
    console.log("joe.worker", joe.worker?.name);
  }, defaultValues.timeout);

  it(
    "should measure creating a group",
    async () => {
      const result = await testMessageFromTo(bob, joe);
      expect(result).toBe(true);
    },
    defaultValues.timeout,
  );
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
