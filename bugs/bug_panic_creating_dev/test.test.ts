import path from "path";
import dotenv from "dotenv";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createLogger,
  flushLogger,
  overrideConsole,
} from "../../helpers/logger";
import { type Persona, type XmtpEnv } from "../../helpers/types";
import { getWorkers } from "../../helpers/workers/factory";

const env: XmtpEnv = "dev";
const testName = "bug_panic_creating_" + env;

dotenv.config({
  path: path.resolve(process.cwd(), `bugs/${testName}/.data/.env`),
});

describe(testName, () => {
  let personas: Record<string, Persona>;

  beforeAll(async () => {
    const logger = await createLogger(testName);
    overrideConsole(logger);
    personas = await getWorkers(
      ["bob", "alice", "joe", "randompep", "elon"],
      env,
      testName,
    );
  });
  afterEach(async () => {
    await Promise.all(
      Object.values(personas).map(async (persona) => {
        await persona.worker?.terminate();
      }),
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

  it("Measure group creation time for 5 participants", async () => {
    const amount = 5;
    const allWorkers = await getWorkers(amount, env, testName);
    const workerArray = Object.values(allWorkers);

    console.time(`create group ${amount}`);
    const inboxIds = workerArray.slice(0, amount).map((p) => p.client!.inboxId);
    const group =
      await workerArray[0].client!.conversations.newGroupByInboxIds(inboxIds);
    console.timeEnd(`create group ${amount}`);
    const members = await group.members();
    for (const member of members) {
      const worker = workerArray.find(
        (w) => w.client!.inboxId === member.inboxId,
      );
      console.log(
        "name:",
        worker?.name,
        "installations:",
        member.installationIds.length,
      );
    }
    expect(group.id).toBeDefined();
  });

  it("Measure group creation time for 15 participants", async () => {
    const amount = 15;
    const allWorkers = await getWorkers(amount, env, testName);
    const workerArray = Object.values(allWorkers);

    console.time(`create group ${amount}`);
    const inboxIds = workerArray.slice(0, amount).map((p) => p.client!.inboxId);
    const group =
      await workerArray[0].client!.conversations.newGroupByInboxIds(inboxIds);
    console.timeEnd(`create group ${amount}`);
    const members = await group.members();
    for (const member of members) {
      const worker = workerArray.find(
        (w) => w.client!.inboxId === member.inboxId,
      );
      console.log(worker?.name, member.inboxId, member.installationIds.length);
    }
    expect(group.id).toBeDefined();
  });

  it("Measure group creation time for 25 participants", async () => {
    const amount = 25;
    const allWorkers = await getWorkers(amount, env, testName);
    const workerArray = Object.values(allWorkers);

    console.time(`create group ${amount}`);
    const inboxIds = workerArray.slice(0, amount).map((p) => p.client!.inboxId);
    const group =
      await workerArray[0].client!.conversations.newGroupByInboxIds(inboxIds);
    console.timeEnd(`create group ${amount}`);
    const members = await group.members();
    for (const member of members) {
      const worker = workerArray.find(
        (w) => w.client!.inboxId === member.inboxId,
      );
      console.log(worker?.name, member.inboxId, member.installationIds.length);
    }
    expect(group.id).toBeDefined();
  });
});
