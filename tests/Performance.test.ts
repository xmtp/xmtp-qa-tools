import fs from "fs";
import { beforeAll, describe, it } from "vitest";
import { testLogger } from "../helpers/logger";
import type { TestCase } from "../helpers/manager";
import {
  defaultValues,
  generateTestCombinations,
  getNewRandomPersona,
  type Persona,
} from "../helpers/personas";

export const performanceTestCases: TestCase[] = [
  {
    name: "TC_PerformanceTest",
    timeout: defaultValues.timeout,
    environments: [defaultValues.env],
    versions: [defaultValues.versions],
    amount: defaultValues.amount,
    installationIds: [defaultValues.installationId],
    describe:
      "Performance test for sending gm, creating group, and sending gm in group",
  },
];

const logger = testLogger.createTest(performanceTestCases[0].name);

describe(performanceTestCases[0].describe, () => {
  generateTestCombinations(performanceTestCases[0], logger, ({ personas }) => {
    let bob: Persona;
    let alice: Persona;
    let joe: Persona;
    let bob41: Persona;
    let alice41: Persona;
    let carol: Persona;
    let carol41: Persona;
    let bobAddress: string;
    let randomAddress: string;
    let aliceAddress: string;
    let joeAddress: string;
    let groupId: string;
    let dmId: string;
    beforeAll(async () => {
      bob = personas.find((p) => p.name === "bob" && p.installationId === "a")!;
      alice = personas.find(
        (p) => p.name === "alice" && p.installationId === "a",
      )!;
      joe = personas.find((p) => p.name === "joe" && p.installationId === "a")!;
      bob41 = personas.find(
        (p) => p.name === "bob" && p.installationId === "b",
      )!;
      alice41 = personas.find(
        (p) => p.name === "alice" && p.installationId === "b",
      )!;

      [bobAddress, aliceAddress, joeAddress] = await Promise.all([
        bob.worker!.initialize(),
        alice.worker!.initialize(),
        joe.worker!.initialize(),
        bob41.worker!.initialize(),
        alice41.worker!.initialize(),
      ]);
      randomAddress = await getNewRandomPersona();
      console.log("randomAddress", randomAddress);
    }, defaultValues.timeout);

    it(
      "should measure creating a DM",
      async () => {
        console.time("createDMTime");
        dmId = await bob.worker!.createDM(randomAddress);
        console.timeEnd("createDMTime");
      },
      defaultValues.timeout,
    );

    it(
      "should measure sending a gm",
      async () => {
        const gmMessage = "gm-" + Math.random().toString(36).substring(2, 15);

        console.time("sendGmTime");
        await bob.worker!.sendMessage(dmId!, gmMessage);
        console.timeEnd("sendGmTime");
      },
      defaultValues.timeout,
    );

    it(
      "should measure sending a gm from SDK 42 to 41",
      async () => {
        const gmMessage = "gm-" + Math.random().toString(36).substring(2, 15);
        console.time("sendGmTime");
        await bob41.worker!.sendMessage(dmId!, gmMessage);
        console.timeEnd("sendGmTime");
      },
      defaultValues.timeout,
    );

    it(
      "should measure creating a group",
      async () => {
        console.time("createGroupTime");
        groupId = await bob.worker!.createGroup([
          joeAddress,
          bobAddress,
          aliceAddress,
        ]);
        console.timeEnd("createGroupTime");
      },
      defaultValues.timeout,
    );

    it(
      "should measure sending a gm in a group",
      async () => {
        const groupMessage =
          "gm-" + Math.random().toString(36).substring(2, 15);

        console.time("sendGmInGroupTime");
        await bob.worker!.sendMessage(groupId!, groupMessage);
        console.timeEnd("sendGmInGroupTime");
      },
      defaultValues.timeout,
    );

    it(
      "should measure stream catch time",
      async () => {
        const groupMessage =
          "gm-" + Math.random().toString(36).substring(2, 15);

        const alicePromise = alice.worker!.receiveMessage(
          groupId!,
          groupMessage,
        );
        const joePromise = joe.worker!.receiveMessage(groupId!, groupMessage);

        console.time("streamCatchTime");
        await bob.worker?.sendMessage(groupId!, groupMessage);
        await Promise.all([alicePromise, joePromise]);
        console.timeEnd("streamCatchTime");
      },
      defaultValues.timeout,
    );
  });
});
