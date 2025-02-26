import path from "path";
import dotenv from "dotenv";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import {
  type Conversation,
  type Persona,
  type XmtpEnv,
} from "../helpers/types";
import { getWorkers } from "../helpers/workers/creator";
import { verifyStream } from "../helpers/workers/messages";

dotenv.config();
dotenv.config({
  path: path.resolve(process.cwd(), `.data/.env`),
});

/**
 * TODO
 * - Test multiple groups with multiple participants with multiple installations
 */
const env: XmtpEnv = "dev";
const testName = "TS_Group_installations_" + env;

/* 
TODO:
- Verify group creation with different participants for incosisten stream results


*/

describe(testName, () => {
  let personas: Record<string, Persona>;
  let bobsGroup: Conversation;
  let gmMessageGenerator: (i: number, suffix: string) => Promise<string>;
  let gmSender: (convo: Conversation, message: string) => Promise<void>;

  beforeAll(async () => {
    gmMessageGenerator = async (i: number, suffix: string) => {
      return `gm-${i + 1}-${suffix}`;
    };
    gmSender = async (convo: Conversation, message: string) => {
      await convo.send(message);
    };
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
