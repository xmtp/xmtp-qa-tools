# SDK Compatibility Layer Design

## Overview

Create a compatibility layer for regression testing that allows workers running older SDK versions (4.3.0 - 5.0.0) to use the same API as workers running SDK 5.1.1. The layer uses feature detection to call the appropriate underlying SDK method.

## Problem

SDK 5.x introduced breaking API changes:

| Method | Old API (SDK 4.x) | New API (SDK 5.x) |
|--------|-------------------|-------------------|
| Create group | `conversations.newGroup()` | `conversations.createGroup()` |
| Create DM | `conversations.newDm()` | `conversations.createDm()` |
| Send text | `conversation.send(text)` | `conversation.sendText(text)` |
| Get consent | `group.consentState` (property) | `group.consentState()` (method) |
| Inbox state | `preferences.inboxState(true)` | `preferences.fetchInboxState()` |
| Inbox states | `preferences.inboxStateFromInboxIds(ids, true)` | `preferences.fetchInboxStates(ids)` |
| Key packages | `client.getKeyPackageStatusesForInstallationIds()` | `client.fetchKeyPackageStatuses()` |

Regression tests (`yarn regression`) create workers with different SDK versions, but test code can only call one API style.

## Solution

### Approach: Feature Detection with Type-Safe Wrappers

Use `in` checks to detect which methods exist, then cast to the appropriate SDK type. This avoids maintaining version number boundaries.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Test Code                          │
│         worker.worker.createGroup(inboxIds)             │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    WorkerClient                         │
│    async createGroup(...) { return createGroupCompat()} │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 helpers/sdk-compat.ts                   │
│   if ("createGroup" in client.conversations)            │
│     return (client as Client511).conversations.createGroup()│
│   return (client as Client43).conversations.newGroup()  │
└─────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Type Definitions in helpers/versions.ts

Add union types alongside the existing SDK imports:

```typescript
// helpers/versions.ts

// ... existing imports ...
import type { Client as Client43, Group as Group43, Conversation as Conversation43 } from "@xmtp/node-sdk-4.3.0";
import type { Client as Client45, Group as Group45, Conversation as Conversation45 } from "@xmtp/node-sdk-4.5.0";
import type { Client as Client46, Group as Group46, Conversation as Conversation46 } from "@xmtp/node-sdk-4.6.0";
import type { Client as Client50, Group as Group50, Conversation as Conversation50 } from "@xmtp/node-sdk-5.0.0";
import type { Client as Client511, Group as Group511, Conversation as Conversation511 } from "@xmtp/node-sdk-5.1.1";

// Union types for any supported SDK version
export type AnyClient = Client43 | Client45 | Client46 | Client50 | Client511;
export type AnyGroup = Group43 | Group45 | Group46 | Group50 | Group511;
export type AnyConversation = Conversation43 | Conversation45 | Conversation46 | Conversation50 | Conversation511;
```

### 2. Compat Helpers in helpers/sdk-compat.ts

```typescript
// helpers/sdk-compat.ts

import type { Client as Client43 } from "@xmtp/node-sdk-4.3.0";
import type { Client as Client511 } from "@xmtp/node-sdk-5.1.1";
import type { AnyClient, AnyGroup, AnyConversation } from "@helpers/versions";

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

export async function createDmCompat(
  client: AnyClient,
  inboxId: string,
): Promise<AnyConversation> {
  if ("createDm" in client.conversations) {
    return (client as Client511).conversations.createDm(inboxId);
  }
  return (client as Client43).conversations.newDm(inboxId);
}

export function getConsentStateCompat(conversation: AnyConversation | AnyGroup): ConsentState {
  if (typeof (conversation as any).consentState === "function") {
    return (conversation as Conversation511).consentState();
  }
  return (conversation as Conversation43).consentState;
}

export async function fetchInboxStateCompat(client: AnyClient) {
  if ("fetchInboxState" in client.preferences) {
    return (client as Client511).preferences.fetchInboxState();
  }
  return (client as Client43).preferences.inboxState(true);
}

export async function fetchInboxStatesCompat(client: AnyClient, inboxIds: string[]) {
  if ("fetchInboxStates" in client.preferences) {
    return (client as Client511).preferences.fetchInboxStates(inboxIds);
  }
  return (client as Client43).preferences.inboxStateFromInboxIds(inboxIds, true);
}

export async function fetchKeyPackageStatusesCompat(
  client: AnyClient,
  installationIds: string[],
): Promise<Record<string, any>> {
  if ("fetchKeyPackageStatuses" in client) {
    return (client as Client511).fetchKeyPackageStatuses(installationIds);
  }
  return (client as Client43).getKeyPackageStatusesForInstallationIds(installationIds);
}
```

### 3. WorkerClient Wrapper Methods

```typescript
// workers/main.ts

import {
  createGroupCompat,
  createDmCompat,
  fetchInboxStateCompat,
  fetchInboxStatesCompat,
  fetchKeyPackageStatusesCompat,
} from "@helpers/sdk-compat";
import type { AnyGroup, AnyConversation } from "@helpers/versions";

export class WorkerClient extends Worker implements IWorkerClient {
  async createGroup(
    inboxIds: string[],
    options?: { groupName?: string },
  ): Promise<AnyGroup> {
    return createGroupCompat(this.client, inboxIds, options);
  }

  async createDm(inboxId: string): Promise<AnyConversation> {
    return createDmCompat(this.client, inboxId);
  }

  async fetchInboxState() {
    return fetchInboxStateCompat(this.client);
  }

  async fetchInboxStates(inboxIds: string[]) {
    return fetchInboxStatesCompat(this.client, inboxIds);
  }

  async fetchKeyPackageStatuses(installationIds: string[]) {
    return fetchKeyPackageStatusesCompat(this.client, installationIds);
  }
}
```

### 4. IWorkerClient Interface Update

```typescript
interface IWorkerClient {
  // ... existing methods ...

  // Version-compatible SDK methods
  createGroup(inboxIds: string[], options?: { groupName?: string }): Promise<AnyGroup>;
  createDm(inboxId: string): Promise<AnyConversation>;
  fetchInboxState(): Promise<InboxState>;
  fetchInboxStates(inboxIds: string[]): Promise<InboxState[]>;
  fetchKeyPackageStatuses(installationIds: string[]): Promise<Record<string, any>>;
}
```

### 5. Existing Helper (No Changes)

`sendTextCompat` already exists in sdk-compat.ts and works as a standalone function:

```typescript
export const sendTextCompat = async (conversation: any, text: string): Promise<unknown> => {
  if (typeof conversation.sendText === "function") {
    return await conversation.sendText(text);
  } else if (typeof conversation.send === "function") {
    return await conversation.send(text);
  }
  throw new Error("Conversation does not have send or sendText method");
};
```

## Migration

### Files to Update

1. **workers/manager.ts** - `createGroupBetweenAll()` to use `creator.worker.createGroup()`
2. **monitoring/performance.test.ts** - Use worker compat methods
3. **monitoring/delivery.test.ts** - Use worker compat methods
4. **measurements/perf-matrix.test.ts** - Use worker compat methods
5. **helpers/streams.ts** - Use compat helpers
6. **helpers/client.ts** - Use compat helpers

### Usage Examples

Before:
```typescript
const group = await creator.client.conversations.createGroup(inboxIds);
const state = await worker.client.preferences.fetchInboxState();
```

After:
```typescript
const group = await creator.worker.createGroup(inboxIds);
const state = await worker.worker.fetchInboxState();
```

For sending text (unchanged):
```typescript
import { sendTextCompat } from "@helpers/sdk-compat";
await sendTextCompat(conversation, "Hello");
```

## Testing

Run regression tests to verify compatibility across SDK versions:

```bash
yarn regression  # Uses TEST_VERSIONS=3 by default
```

This tests with SDK versions 5.1.1, 5.0.0, and 4.6.0.
