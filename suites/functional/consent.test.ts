import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { ConsentState } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

describe("consent", async () => {
  const workers = await getWorkers(["alice", "bob"]);
  setupTestLifecycle({});

  it("should handle consent state changes", async () => {
    const alice = workers.get("alice")!;
    const bob = workers.get("bob")!;

    // Check initial consent state
    const initialState = await alice.client.contacts.getConsentState(
      bob.client.inboxId,
    );
    expect([ConsentState.Unknown, ConsentState.Allowed]).toContain(
      initialState,
    );

    // Allow contact
    await alice.client.contacts.allow([bob.client.inboxId]);
    const allowedState = await alice.client.contacts.getConsentState(
      bob.client.inboxId,
    );
    expect(allowedState).toBe(ConsentState.Allowed);

    // Block contact
    await alice.client.contacts.deny([bob.client.inboxId]);
    const blockedState = await alice.client.contacts.getConsentState(
      bob.client.inboxId,
    );
    expect(blockedState).toBe(ConsentState.Denied);
  });
});
