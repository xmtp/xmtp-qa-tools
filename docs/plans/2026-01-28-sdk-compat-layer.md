# SDK Compatibility Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add version-compatible wrapper methods to WorkerClient that enable regression testing across SDK versions 4.3.0 through 5.1.1.

**Architecture:** Union types in `helpers/versions.ts`, feature-detection compat helpers in `helpers/sdk-compat.ts`, thin wrapper methods on `WorkerClient` class.

**Tech Stack:** TypeScript, XMTP Node SDK 4.3.0-5.1.1

---

### Task 1: Add Union Types to helpers/versions.ts

**Files:**

- Modify: `helpers/versions.ts:11-42` (after existing imports)

**Step 1: Add the union type exports after the SDK imports**

Add after line 81 (after the `export { ... } from "@xmtp/node-sdk-5.1.1";` block):

```typescript
// Union types for any supported SDK version (used by compat layer)
export type AnyClient = typeof Client43 extends new (...args: any[]) => infer R
  ? R
  : never | typeof Client45 extends new (...args: any[]) => infer R
    ? R
    : never | typeof Client46 extends new (...args: any[]) => infer R
      ? R
      : never | typeof Client50 extends new (...args: any[]) => infer R
        ? R
        : never | typeof Client511 extends new (...args: any[]) => infer R
          ? R
          : never;

export type AnyGroup = Group43 | Group45 | Group46 | Group50 | Group511;
export type AnyConversation =
  | Conversation43
  | Conversation45
  | Conversation46
  | Conversation50
  | Conversation511;
export type AnyDm = Dm43 | Dm45 | Dm46 | Dm50 | Dm511;
```

**Step 2: Verify build passes**

Run: `yarn build`
Expected: No errors

**Step 3: Commit**

```bash
git add helpers/versions.ts
git commit -m "feat: add union types for SDK compatibility layer"
```

---

### Task 2: Add createGroupCompat to sdk-compat.ts

**Files:**

- Modify: `helpers/sdk-compat.ts`

**Step 1: Add imports and createGroupCompat function**

Add at the top of the file (after line 10):

```typescript
import type { AnyClient, AnyGroup } from "@helpers/versions";
import type { Client as Client43 } from "@xmtp/node-sdk-4.3.0";
import type { Client as Client511 } from "@xmtp/node-sdk-5.1.1";
```

Add after the existing `ensureDecodedMessage` function:

```typescript
/**
 * Create a group - uses createGroup() or falls back to newGroup()
 */
export async function createGroupCompat(
  client: AnyClient,
  inboxIds: string[],
  options?: { groupName?: string },
): Promise<AnyGroup> {
  if ("createGroup" in client.conversations) {
    return (client as Client511).conversations.createGroup(inboxIds, options);
  }
  return (client as Client43).conversations.newGroup(inboxIds, options);
}
```

**Step 2: Verify build passes**

Run: `yarn build`
Expected: No errors

**Step 3: Commit**

```bash
git add helpers/sdk-compat.ts
git commit -m "feat: add createGroupCompat helper"
```

---

### Task 3: Add createDmCompat to sdk-compat.ts

**Files:**

- Modify: `helpers/sdk-compat.ts`

**Step 1: Add createDmCompat function**

Add after `createGroupCompat`:

```typescript
/**
 * Create a DM - uses createDm() or falls back to newDm()
 */
export async function createDmCompat(
  client: AnyClient,
  inboxId: string,
): Promise<AnyConversation> {
  if ("createDm" in client.conversations) {
    return (client as Client511).conversations.createDm(inboxId);
  }
  return (client as Client43).conversations.newDm(inboxId);
}
```

**Step 2: Update imports**

Add `AnyConversation` to the import from `@helpers/versions`:

```typescript
import type { AnyClient, AnyConversation, AnyGroup } from "@helpers/versions";
```

**Step 3: Verify build passes**

Run: `yarn build`
Expected: No errors

**Step 4: Commit**

```bash
git add helpers/sdk-compat.ts
git commit -m "feat: add createDmCompat helper"
```

---

### Task 4: Add fetchInboxStateCompat to sdk-compat.ts

**Files:**

- Modify: `helpers/sdk-compat.ts`

**Step 1: Add fetchInboxStateCompat function**

Add after `createDmCompat`:

```typescript
/**
 * Fetch inbox state - uses fetchInboxState() or falls back to inboxState(true)
 */
export async function fetchInboxStateCompat(client: AnyClient) {
  if ("fetchInboxState" in client.preferences) {
    return (client as Client511).preferences.fetchInboxState();
  }
  return (client as Client43).preferences.inboxState(true);
}
```

**Step 2: Verify build passes**

Run: `yarn build`
Expected: No errors

**Step 3: Commit**

```bash
git add helpers/sdk-compat.ts
git commit -m "feat: add fetchInboxStateCompat helper"
```

---

### Task 5: Add fetchInboxStatesCompat to sdk-compat.ts

**Files:**

- Modify: `helpers/sdk-compat.ts`

**Step 1: Add fetchInboxStatesCompat function**

Add after `fetchInboxStateCompat`:

```typescript
/**
 * Fetch inbox states for multiple inboxIds - uses fetchInboxStates() or falls back to inboxStateFromInboxIds()
 */
export async function fetchInboxStatesCompat(
  client: AnyClient,
  inboxIds: string[],
) {
  if ("fetchInboxStates" in client.preferences) {
    return (client as Client511).preferences.fetchInboxStates(inboxIds);
  }
  return (client as Client43).preferences.inboxStateFromInboxIds(
    inboxIds,
    true,
  );
}
```

**Step 2: Verify build passes**

Run: `yarn build`
Expected: No errors

**Step 3: Commit**

```bash
git add helpers/sdk-compat.ts
git commit -m "feat: add fetchInboxStatesCompat helper"
```

---

### Task 6: Add fetchKeyPackageStatusesCompat to sdk-compat.ts

**Files:**

- Modify: `helpers/sdk-compat.ts`

**Step 1: Add fetchKeyPackageStatusesCompat function**

Add after `fetchInboxStatesCompat`:

```typescript
/**
 * Fetch key package statuses - uses fetchKeyPackageStatuses() or falls back to getKeyPackageStatusesForInstallationIds()
 */
export async function fetchKeyPackageStatusesCompat(
  client: AnyClient,
  installationIds: string[],
): Promise<Record<string, unknown>> {
  if ("fetchKeyPackageStatuses" in client) {
    return (client as Client511).fetchKeyPackageStatuses(installationIds);
  }
  return (client as Client43).getKeyPackageStatusesForInstallationIds(
    installationIds,
  );
}
```

**Step 2: Verify build passes**

Run: `yarn build`
Expected: No errors

**Step 3: Commit**

```bash
git add helpers/sdk-compat.ts
git commit -m "feat: add fetchKeyPackageStatusesCompat helper"
```

---

### Task 7: Add getConsentStateCompat to sdk-compat.ts

**Files:**

- Modify: `helpers/sdk-compat.ts`

**Step 1: Add imports for ConsentState and Conversation types**

Update imports:

```typescript
import type {
  AnyClient,
  AnyConversation,
  AnyGroup,
  ConsentState,
} from "@helpers/versions";
import type {
  Client as Client43,
  Conversation as Conversation43,
} from "@xmtp/node-sdk-4.3.0";
import type {
  Client as Client511,
  Conversation as Conversation511,
} from "@xmtp/node-sdk-5.1.1";
```

**Step 2: Add getConsentStateCompat function**

Add after `fetchKeyPackageStatusesCompat`:

```typescript
/**
 * Get consent state - handles method vs property difference between SDK versions
 */
export function getConsentStateCompat(
  conversation: AnyConversation | AnyGroup,
): ConsentState {
  if (typeof (conversation as Conversation511).consentState === "function") {
    return (conversation as Conversation511).consentState();
  }
  return (conversation as Conversation43).consentState;
}
```

**Step 3: Verify build passes**

Run: `yarn build`
Expected: No errors

**Step 4: Commit**

```bash
git add helpers/sdk-compat.ts
git commit -m "feat: add getConsentStateCompat helper"
```

---

### Task 8: Update IWorkerClient interface in workers/main.ts

**Files:**

- Modify: `workers/main.ts:51-122`

**Step 1: Add imports at top of file**

Add to existing imports from `@helpers/versions`:

```typescript
import {
  ConsentState,
  ConversationType,
  regressionClient,
  type AnyClient,
  type AnyConversation,
  type AnyGroup,
  type Client,
  type DecodedMessage,
  type Message,
  type XmtpEnv,
} from "@helpers/versions";
```

Add import for compat helpers:

```typescript
import {
  createDmCompat,
  createGroupCompat,
  fetchInboxStateCompat,
  fetchInboxStatesCompat,
  fetchKeyPackageStatusesCompat,
  sendTextCompat,
} from "@helpers/sdk-compat";
```

**Step 2: Update IWorkerClient interface**

Add before the `// Properties` comment in the interface (around line 116):

```typescript
  // Version-compatible SDK methods
  createGroup(inboxIds: string[], options?: { groupName?: string }): Promise<AnyGroup>;
  createDm(inboxId: string): Promise<AnyConversation>;
  fetchInboxState(): Promise<any>;
  fetchInboxStates(inboxIds: string[]): Promise<any[]>;
  fetchKeyPackageStatuses(installationIds: string[]): Promise<Record<string, unknown>>;
```

**Step 3: Verify build passes**

Run: `yarn build`
Expected: No errors (will fail until we add implementations)

**Step 4: Commit**

```bash
git add workers/main.ts
git commit -m "feat: update IWorkerClient interface with compat methods"
```

---

### Task 9: Add wrapper methods to WorkerClient class

**Files:**

- Modify: `workers/main.ts` (add methods to WorkerClient class, before the `terminate()` method around line 291)

**Step 1: Add the wrapper methods to WorkerClient**

Add after the constructor and before `terminate()`:

```typescript
  /**
   * Create a group (version-compatible)
   */
  async createGroup(
    inboxIds: string[],
    options?: { groupName?: string },
  ): Promise<AnyGroup> {
    return createGroupCompat(this.client as AnyClient, inboxIds, options);
  }

  /**
   * Create a DM (version-compatible)
   */
  async createDm(inboxId: string): Promise<AnyConversation> {
    return createDmCompat(this.client as AnyClient, inboxId);
  }

  /**
   * Fetch inbox state with refresh (version-compatible)
   */
  async fetchInboxState() {
    return fetchInboxStateCompat(this.client as AnyClient);
  }

  /**
   * Fetch inbox states for multiple inboxIds (version-compatible)
   */
  async fetchInboxStates(inboxIds: string[]) {
    return fetchInboxStatesCompat(this.client as AnyClient, inboxIds);
  }

  /**
   * Fetch key package statuses (version-compatible)
   */
  async fetchKeyPackageStatuses(installationIds: string[]) {
    return fetchKeyPackageStatusesCompat(this.client as AnyClient, installationIds);
  }
```

**Step 2: Verify build passes**

Run: `yarn build`
Expected: No errors

**Step 3: Commit**

```bash
git add workers/main.ts
git commit -m "feat: add version-compatible wrapper methods to WorkerClient"
```

---

### Task 10: Update WorkerManager.createGroupBetweenAll

**Files:**

- Modify: `workers/manager.ts:274-290`

**Step 1: Update createGroupBetweenAll to use compat method**

Replace the existing implementation:

```typescript
  async createGroupBetweenAll(
    groupName: string = `Test Group ${Math.random().toString(36).substring(2, 15)}`,
    extraMembers: string[] = [],
  ): Promise<Group> {
    const creator = this.mustGetCreator();
    const memberList = this.getAllButCreator().map(
      (worker) => worker.client.inboxId,
    );
    const group = await creator.worker.createGroup(memberList, {
      groupName,
    });
    if (extraMembers.length > 0) {
      await group.addMembers(extraMembers);
    }

    return group as Group;
  }
```

**Step 2: Verify build passes**

Run: `yarn build`
Expected: No errors

**Step 3: Commit**

```bash
git add workers/manager.ts
git commit -m "refactor: use compat method in createGroupBetweenAll"
```

---

### Task 11: Final verification

**Step 1: Run full check**

Run: `yarn c`
Expected: Format, build, and lint all pass

**Step 2: Verify the design doc is accurate**

Review `docs/plans/2026-01-28-sdk-compat-layer-design.md` matches implementation.

**Step 3: Final commit if any changes**

```bash
git add -A
git commit -m "chore: final cleanup for SDK compat layer"
```
