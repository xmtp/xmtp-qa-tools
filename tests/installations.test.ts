import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../helpers/client";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { type Persona, type XmtpEnv } from "../helpers/types";
import {
  createMultipleInstallations,
  getWorkers,
} from "../helpers/workers/factory";

/**
 * TODO
 * - Test multiple groups with multiple participants with multiple installations
  - Verify group creation with different participants for incosisten stream results
*/

const env: XmtpEnv = "dev";
const testName = "installations_" + env;
loadEnv(testName);

describe(
  testName,
  () => {
    beforeAll(async () => {
      const logger = await createLogger(testName);
      overrideConsole(logger);
    });

    afterAll(async () => {
      await flushLogger(testName);
    });
    const baseNames = ["bob", "alice", "sam"];
    const users = baseNames.length;
    const installationsPerUser = 5;
    const suffixes = Array.from({ length: installationsPerUser }, (_, i) =>
      String.fromCharCode(97 + i),
    );
    let personas: Record<string, Persona> = {};

    it(`Measure group creation time up to ${users * installationsPerUser} participants`, async () => {
      // Create a base persona and multiple installations

      console.time("personas creation");
      personas = await getWorkers(baseNames, env, testName);
      console.timeEnd("personas creation");
      const creator = Object.values(personas)[0];

      const convo = await creator.client?.conversations.newGroupByInboxIds(
        Object.values(personas).map((p) => p.client?.inboxId ?? ""),
      );
      console.time("syncing");
      await convo?.sync();
      expect(convo?.id).toBeDefined();
      console.timeEnd("syncing");

      for (const persona of Object.values(personas)) {
        console.time("installation creation");
        const installations = await createMultipleInstallations(
          persona,
          suffixes,
          env,
          testName,
        );
        console.timeEnd("installation creation");
        // Log the installation details
        for (const [_id, persona] of Object.entries(installations)) {
          console.log(
            `Name: ${persona.name}, Installation ID: ${persona.installationId}, DB Path: ${persona.dbPath}`,
          );
        }

        console.time("syncing");
        await convo?.sync();
        console.timeEnd("syncing");

        console.time("adding members");
        for (const installation of Object.values(installations)) {
          await convo?.addMembersByInboxId([
            installation.client?.inboxId ?? "",
          ]);
        }
        console.timeEnd("adding members");

        console.time("syncing");
        await convo?.sync();
        console.timeEnd("syncing");

        console.time("members fetching");
        const members = await convo?.members();
        expect(members?.length).toBe(users);
        console.timeEnd("members fetching");

        let totalInstallations = 0;
        for (const member of members ?? []) {
          totalInstallations += member.installationIds.length;
        }
        console.log(`Total installations: ${totalInstallations}`);

        console.time("message sending");
        await convo?.send("Hello");
        console.timeEnd("message sending");

        console.time("message receiving");
        const messages = await convo?.messages();
        expect(messages?.length).toBeGreaterThan(1);
        console.timeEnd("message receiving");

        console.time("syncing");
        await convo?.sync();
        console.timeEnd("syncing");
      }
    });
  },
  { timeout: 1000000 },
);
