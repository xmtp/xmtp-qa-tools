import { verifyMessageStream } from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Dm, type Group } from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "convos";
describe(testName, async () => {
  setupDurationTracking({ testName });
  let newGroup: Group;
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [5, 10];
  const workers = await getWorkers([
    "henry",
    "ivy",
    "jack",
    "karen",
    "randomguy",
    "randomguy2",
    "larry",
    "mary",
    "nancy",
    "oscar",
  ]);

  let convo: Dm;

  it("newDm:create a new DM conversation using inbox ID", async () => {
    convo = (await workers
      .get("henry")!
      .client.conversations.newDm(
        workers.get("randomguy")!.client.inboxId,
      )) as Dm;

    expect(convo).toBeDefined();
    expect(convo.id).toBeDefined();
  });

  it("newDmByAddress:create a new DM conversation using Ethereum address", async () => {
    const dm2 = await workers
      .get("henry")!
      .client.conversations.newDmWithIdentifier({
        identifier: workers.get("randomguy2")!.address,
        identifierKind: IdentifierKind.Ethereum,
      });

    expect(dm2).toBeDefined();
    expect(dm2.id).toBeDefined();
  });
  it("send:send a message in DM conversation", async () => {
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    console.log(
      `Creating DM with ${workers.get("randomguy")?.name} at ${workers.get("randomguy")?.client.inboxId}`,
    );

    const dmId = await convo.send(message);

    expect(dmId).toBeDefined();
  });

  it("streamMessage:receive and message delivery in DM conversation", async () => {
    const verifyResult = await verifyMessageStream(convo, [
      workers.get("randomguy")!,
    ]);
    expect(verifyResult.allReceived).toBe(true);
  });
  console.warn(BATCH_SIZE);
  for (const i of BATCH_SIZE) {
    it(`create a group with ${i} members`, async () => {
      const sliced = getRandomInboxIds(i);
      console.log("Creating group with", sliced.length, "members");
      newGroup = (await workers
        .getCreator()
        .client.conversations.newGroup(sliced)) as Group;
      console.log("Group created", newGroup.id);
      expect(newGroup.id).toBeDefined();
    });
    it(`sync group with ${i} members and member count`, async () => {
      await newGroup.sync();
      const members = await newGroup.members();
      expect(members.length).toBe(i + 1);
    });
    it(`update group name for ${i}-member group`, async () => {
      const newName = "Large Group";
      await newGroup.updateName(newName);
      await newGroup.sync();
      const name = newGroup.name;
      expect(name).toBe(newName);
    });
  }
});
