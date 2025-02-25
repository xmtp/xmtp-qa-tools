import path from "path";
import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { WorkerNames, type Conversation, type Persona } from "../helpers/types";
import { getWorkers } from "../helpers/workers/creator";
import { verifyStream } from "../helpers/workers/stream";

dotenv.config();
dotenv.config({
  path: path.resolve(process.cwd(), `.data/.env`),
});

const env = "dev";
const testName = "TS_Metadata_" + env;

describe(testName, () => {
  let bobsGroup: Conversation;
  let personas: Record<string, Persona>;
  beforeAll(async () => {
    const logger = await createLogger(testName);
    overrideConsole(logger);
    personas = await getWorkers(
      [
        WorkerNames.BOB,
        WorkerNames.JOE,
        WorkerNames.ELON,
        WorkerNames.FABRI,
        WorkerNames.ALICE,
      ],
      "dev",
      testName,
    );

    console.time("create group");
    bobsGroup = await personas[WorkerNames.BOB].client!.conversations.newGroup([
      personas[WorkerNames.BOB].client?.accountAddress as `0x${string}`,
      personas[WorkerNames.JOE].client?.accountAddress as `0x${string}`,
      personas[WorkerNames.ELON].client?.accountAddress as `0x${string}`,
    ]);
    console.log("Bob's group", bobsGroup.id);
    console.timeEnd("create group");
  });

  afterAll(async () => {
    await flushLogger(testName);
    await Promise.all(
      Object.values(personas).map(async (persona) => {
        await persona.worker?.terminate();
      }),
    );
  });

  it("TC_ReceiveMetadata: should update group name", async () => {
    console.time("update group name");
    const nameUpdateGenerator = async (i: number, suffix: string) => {
      return `New name-${i + 1}-${suffix}`;
    };

    const nameUpdater = async (group: Conversation, newName: string) => {
      console.log("Updating group name to", newName, "for group", group.id);
      await group.updateName(newName);
    };
    const verifyResult = await verifyStream(
      bobsGroup,
      [personas["joe"]],
      nameUpdateGenerator,
      nameUpdater,
      "group_updated",
    );
    expect(verifyResult.allReceived).toBe(true);
    console.timeEnd("update group name");
  });

  it("TC_AddMembers: should measure adding a participant to a group", async () => {
    console.time("add members");
    await bobsGroup.addMembers([
      personas[WorkerNames.FABRI].client?.accountAddress as `0x${string}`,
    ]);
    const members = await bobsGroup.members();
    console.timeEnd("add members");
    expect(members.length).toBe(4);
  });

  it("TC_RemoveMembers: should remove a participant from a group", async () => {
    console.time("remove members");
    await bobsGroup.removeMembers([
      personas[WorkerNames.FABRI].client?.accountAddress as `0x${string}`,
    ]);
    const members = await bobsGroup.members();
    console.timeEnd("remove members");
    expect(members.length).toBe(3);
  });
});
