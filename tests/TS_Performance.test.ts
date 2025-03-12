import { closeEnv, loadEnv } from "@helpers/client";
import { sendTestResults } from "@helpers/datadog";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { exportTestResults, logError } from "@helpers/tests";
import {
  IdentifierKind,
  type Conversation,
  type Group,
  type NestedPersonas,
} from "@helpers/types";
import { verifyStream, verifyStreamAll } from "@helpers/verify";
import { getWorkers } from "@helpers/workers/factory";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

const testName = "ts_performance";
loadEnv(testName);

describe(testName, () => {
  let dm: Conversation;
  let personas: NestedPersonas;
  let start: number;
  let hasFailures: boolean = false;
  const batchSize = parseInt(process.env.BATCH_SIZE ?? "5");
  const total = parseInt(process.env.MAX_GROUP_SIZE ?? "10");

  beforeAll(async () => {
    try {
      personas = await getWorkers(
        [
          "henry",
          "ivy",
          "jack",
          "karen",
          "randomguy",
          "larry",
          "mary",
          "nancy",
          "oscar",
        ],
        testName,
      );
      expect(personas).toBeDefined();
      expect(personas.getPersonas().length).toBe(9);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });
  beforeEach(() => {
    const testName = expect.getState().currentTestName;
    start = performance.now();
    console.time(testName);
  });

  afterEach(function () {
    try {
      exportTestResults(expect, personas, start);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  afterAll(async () => {
    try {
      sendTestResults(hasFailures ? "failure" : "success", testName);
      await closeEnv(testName, personas);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("inboxState: should measure inboxState of henry", async () => {
    try {
      const inboxState = await personas.get("henry")!.client.inboxState(true);
      expect(inboxState.installations.length).toBeGreaterThan(0);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });
  it("createDM: should measure creating a DM", async () => {
    try {
      dm = await personas
        .get("henry")!
        .client.conversations.newDm(personas.get("randomguy")!.client.inboxId);

      expect(dm).toBeDefined();
      expect(dm.id).toBeDefined();
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("sendGM: should measure sending a gm", async () => {
    try {
      // We'll expect this random message to appear in Joe's stream
      const message = "gm-" + Math.random().toString(36).substring(2, 15);

      console.log(
        `[${personas.get("henry")!.name}] Creating DM with ${personas.get("randomguy")!.name} at ${personas.get("randomguy")!.client.inboxId}`,
      );

      const dmId = await dm.send(message);

      expect(dmId).toBeDefined();
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("receiveGM: should measure receiving a gm", async () => {
    try {
      const verifyResult = await verifyStream(dm, [personas.get("randomguy")!]);

      expect(verifyResult.messages.length).toEqual(1);
      expect(verifyResult.allReceived).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  for (let i = batchSize; i <= total; i += batchSize) {
    let newGroup: Conversation;
    it(`createGroup-${i}: should create a large group of ${i} participants ${i}`, async () => {
      try {
        const sliced = generatedInboxes.slice(0, i);
        newGroup = await personas
          .get("henry")!
          .client.conversations.newGroup(sliced.map((inbox) => inbox.inboxId));
        expect(newGroup.id).toBeDefined();
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
    it(`createGroupByIdentifiers-${i}: should create a large group of ${i} participants ${i}`, async () => {
      try {
        const sliced = generatedInboxes.slice(0, i);
        const newGroupByIdentifier = await personas
          .get("henry")!
          .client.conversations.newGroupByIdentifiers(
            sliced.map((inbox) => ({
              identifier: inbox.accountAddress,
              identifierKind: IdentifierKind.Ethereum,
            })),
          );
        expect(newGroupByIdentifier.id).toBeDefined();
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
    it(`syncGroup-${i}: should sync a large group of ${i} participants ${i}`, async () => {
      try {
        await newGroup.sync();
        const members = await newGroup.members();
        expect(members.length).toBe(i + 1);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
    it(`updateGroupName-${i}: should update the group name`, async () => {
      try {
        const newName = "Large Group";
        await (newGroup as Group).updateName(newName);
        await newGroup.sync();
        const name = (newGroup as Group).name;
        expect(name).toBe(newName);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
    it(`removeMembers-${i}: should remove a participant from a group`, async () => {
      try {
        const previousMembers = await newGroup.members();
        await (newGroup as Group).removeMembers([
          previousMembers.filter(
            (member) => member.inboxId !== (newGroup as Group).addedByInboxId,
          )[0].inboxId,
        ]);

        const members = await newGroup.members();
        expect(members.length).toBe(previousMembers.length - 1);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
    it(`sendGroupMessage-${i}: should measure sending a gm in a group of ${i} participants`, async () => {
      try {
        const groupMessage =
          "gm-" + Math.random().toString(36).substring(2, 15);

        await newGroup.send(groupMessage);
        console.log("GM Message sent in group", groupMessage);
        expect(groupMessage).toBeDefined();
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
    it(`receiveGroupMessage-${i}: should create a group and measure all streams`, async () => {
      try {
        const verifyResult = await verifyStreamAll(newGroup, personas);
        expect(verifyResult.allReceived).toBe(true);
      } catch (e) {
        hasFailures = logError(e, expect);
        throw e;
      }
    });
  }
});
