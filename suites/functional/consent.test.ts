import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { ConsentEntityType, ConsentState } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

describe("consent", async () => {
  const workers = await getWorkers(["alice", "bob"]);
  setupTestLifecycle({});

  it("should handle consent state changes", async () => {
    const alice = workers.get("alice")!;
    const bob = workers.get("bob")!;

    // Check initial consent state
    const initialState = await alice.client.preferences.getConsentState(
      ConsentEntityType.InboxId,
      bob.client.inboxId,
    );
    expect([ConsentState.Unknown, ConsentState.Allowed]).toContain(
      initialState,
    );

    // Allow contact
    await alice.client.preferences.setConsentStates([
      {
        entity: bob.client.inboxId,
        entityType: ConsentEntityType.InboxId,
        state: ConsentState.Allowed,
      },
    ]);
    const allowedState = await alice.client.preferences.getConsentState(
      ConsentEntityType.InboxId,
      bob.client.inboxId,
    );
    expect(allowedState).toBe(ConsentState.Allowed);

    // Block contact
    await alice.client.preferences.setConsentStates([
      {
        entity: bob.client.inboxId,
        entityType: ConsentEntityType.InboxId,
        state: ConsentState.Denied,
      },
    ]);
    const blockedState = await alice.client.preferences.getConsentState(
      ConsentEntityType.InboxId,
      bob.client.inboxId,
    );
    expect(blockedState).toBe(ConsentState.Denied);
  });
});
