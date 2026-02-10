import { sendTextCompat } from "@helpers/sdk-compat";
import { type Group } from "@helpers/versions";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "sync";
describe(testName, () => {
  it("create a group", async () => {
    const workers = await getWorkers(["henry", "john"]);
    const creator = workers.mustGet("henry");
    const receiver = workers.mustGet("john");

    // Start the conversation stream BEFORE creating the group
    const stream = receiver.client.conversations.stream();

    // Create the group with the receiver as a member
    const group = (await creator.client.conversations.createGroup([
      receiver.client.inboxId,
    ])) as Group;
    console.log("Group created", group.id);

    await sendTextCompat(group, "test message");

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Timed out waiting for conversation stream"));
      }, 30000);
    });

    const streamPromise = (async () => {
      for await (const conversation of await stream) {
        console.log("Conversation", conversation?.id);
        expect(conversation?.id).toBe(group.id);
        break;
      }
    })();

    await Promise.race([streamPromise, timeoutPromise]);
  });
});
