import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { type Dm } from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "sync";
describe(testName, () => {
  setupTestLifecycle({ testName });

  it("stitching", async () => {
    const workers = await getWorkers(["randombob-a", "alice"]);
    let creator = workers.get("randombob", "a")!;
    const receiver = workers.get("alice")!;
    const dm = (await creator.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;

    console.log("New dm created", dm.id);

    const resultFirstDm = await verifyMessageStream(dm, [receiver]);
    expect(resultFirstDm.allReceived).toBe(true);

    // Create fresh random1 client
    const bobB = await getWorkers(["randombob-b"]);
    creator = bobB.get("randombob", "b")!;
    const secondDm = (await creator.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    console.log("New dm created", dm.id);

    const resultSecondDm = await verifyMessageStream(secondDm, [receiver]);
    expect(resultSecondDm.allReceived).toBe(false);
  });
});
