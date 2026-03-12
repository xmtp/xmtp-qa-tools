# Adding a New Node SDK Version to Regression Testing

## Overview

The regression test suite (`yarn regression`) tests XMTP operations across multiple Node SDK versions to catch backward-compatibility issues. This guide walks through adding a new SDK version and verifying it passes regression.

## Current Setup (as of writing)

The `yarn regression` command runs:
```bash
yarn versions && yarn test performance --env dev --sync all --versions 3 --size 10-100 && yarn test bugs
```

- `yarn versions` — sets up symlinks so each SDK version uses its correct `node-bindings`
- `--versions 3` — tests the first 3 entries in `VersionList` (currently: 5.0.0, 4.6.0, 4.5.0)

Current `VersionList` order in `helpers/versions.ts`:
| Node SDK | Node Bindings | package.json alias target |
|----------|--------------|--------------------------|
| 5.0.0    | 1.9.1        | `@xmtp/node-sdk@5.3.0`  |
| 4.6.0    | 1.6.0        | `@xmtp/node-sdk@4.6.0`  |
| 4.5.0    | 1.6.0        | `@xmtp/node-sdk@4.5.0`  |
| 4.4.0    | 1.5.0        | `@xmtp/node-sdk@4.4.0`  |
| 4.3.0    | 1.4.0        | `@xmtp/node-sdk@4.3.0`  |

**Important naming rule:** Version strings in `VersionList` CANNOT contain hyphens (`-`). Use simplified version numbers (e.g., `1.9.1` not `1.9.1-rc1`). The actual npm version with pre-release suffixes goes in `package.json`.

---

## Step-by-Step: Adding a New Version

### Step 1: Verify existing tests pass

Before adding anything new, confirm the current setup is green:

```bash
yarn versions
yarn test performance --env dev --versions 3
```

If these fail, fix them first — you need a clean baseline.

### Step 2: Identify the new SDK and bindings versions

Determine:
- The new **Node SDK** version (e.g., `5.4.0`)
- The matching **Node Bindings** version (e.g., `2.0.0`)

Check npm for the latest releases:
```bash
npm view @xmtp/node-sdk versions --json | tail -5
npm view @xmtp/node-bindings versions --json | tail -5
```

### Step 3: Add aliased packages to `package.json`

Add entries in the `dependencies` section using the npm alias pattern:

```json
"@xmtp/node-sdk-X.Y.Z": "npm:@xmtp/node-sdk@<actual-npm-version>",
"@xmtp/node-bindings-A.B.C": "npm:@xmtp/node-bindings@<actual-npm-version>"
```

**Example** — adding Node SDK 5.4.0 with bindings 2.0.0:
```json
"@xmtp/node-sdk-5.4.0": "npm:@xmtp/node-sdk@5.4.0",
"@xmtp/node-bindings-2.0.0": "npm:@xmtp/node-bindings@2.0.0"
```

Note: The alias label (e.g., `5.0.0`) doesn't have to match the actual npm version (e.g., `5.3.0`). The label is what the rest of the codebase references.

Then install:
```bash
yarn install
```

### Step 4: Add imports to `helpers/versions.ts`

Add a new import block at the top of the file:

```typescript
import {
  Client as ClientXX,
  Conversation as ConversationXX,
  Dm as DmXX,
  Group as GroupXX,
} from "@xmtp/node-sdk-X.Y.Z";
```

If the new version also exports new types (e.g., `LogLevel`, `XmtpEnv`), update the re-exports section to use the newest version.

### Step 5: Add entry to `VersionList` in `helpers/versions.ts`

Add the new version as the **first entry** in `VersionList` (newest first):

```typescript
export const VersionList = [
  {
    Client: ClientXX,
    Conversation: ConversationXX,
    Dm: DmXX,
    Group: GroupXX,
    nodeSDK: "X.Y.Z",
    nodeBindings: "A.B.C",
    auto: true,
  },
  // ... existing entries
];
```

### Step 6: Update union types in `helpers/versions.ts`

Add the new types to the `AnyClient`, `AnyGroup`, `AnyConversation`, and `AnyDm` unions:

```typescript
export type AnyClient =
  | InstanceType<typeof ClientXX>
  | InstanceType<typeof Client50>
  // ...existing

export type AnyGroup = GroupXX | Group50 | ...
export type AnyConversation = ConversationXX | Conversation50 | ...
export type AnyDm = DmXX | Dm50 | ...
```

### Step 7: Update symlink config in `cli/versions.ts`

Add a new entry to `SYMLINK_NODE_BINDINGS`:

```typescript
const SYMLINK_NODE_BINDINGS = [
  { nodeSDK: "X.Y.Z", nodeBindings: "A.B.C" },  // new
  { nodeSDK: "5.0.0", nodeBindings: "1.9.1" },
  // ... existing entries
];
```

### Step 8: Update compat layer if needed (`helpers/sdk-compat.ts`)

If the new SDK version changes any API names (e.g., method renames, new parameters), update the compat functions. Common things to check:
- `createGroup` / `createDm` method names
- `sendText` / `send` method names
- `fetchInboxState` / `inboxState` method names
- `consentState` (method vs property)

### Step 9: Set up symlinks and verify

```bash
yarn versions
```

This installs dependencies and creates the required symlinks between SDK packages and their bindings.

### Step 10: Test the new version in isolation

```bash
# Test only with the new version (it's now index 0 in VersionList)
yarn test performance --env dev --versions 1
```

### Step 11: Run full regression

```bash
yarn regression
```

This tests with `--versions 3`, which now includes your new version plus the next 2 in the list.

---

## Interpreting Results

### What `yarn test performance` checks

The performance test suite measures:
- **Message send/receive timing** across SDK versions
- **Stream reliability** (reception percentage)
- **Group operations** (create, sync, admin management)
- **Cross-version interoperability** (e.g., SDK 5.4.0 client talking to SDK 4.6.0 client)

### What `yarn test bugs` checks

Runs regression tests for previously-fixed bugs to ensure they don't resurface.

### What to look for

- **All tests passing**: Green across all versions means the new SDK is backward-compatible.
- **Version-specific failures**: If tests fail only with the new version, there may be a breaking API change — check if `sdk-compat.ts` needs updating.
- **Cross-version failures**: If tests fail when mixing the new version with older ones, there may be a protocol-level incompatibility.
- **Performance regressions**: Compare timing metrics across versions. Significant slowdowns in the new version warrant investigation.

### Common failure modes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Import error on new SDK | Missing symlink or wrong bindings | Check `cli/versions.ts` config, re-run `yarn versions` |
| `method not found` errors | API renamed in new version | Add compat wrapper in `helpers/sdk-compat.ts` |
| Version string contains `-` | Pre-release suffix in VersionList | Use simplified version (e.g., `2.0.0` not `2.0.0-rc1`) |
| `version.json` import error | SDK doesn't export version.json | Use dynamic import with try/catch (see 4.4.0 pattern) |
| Cross-version message failures | Protocol change | May need XMTP team investigation |

---

## Quick Reference: Files to Modify

| File | What to change |
|------|---------------|
| `package.json` | Add aliased `@xmtp/node-sdk-X.Y.Z` and `@xmtp/node-bindings-A.B.C` dependencies |
| `helpers/versions.ts` | Add import, add to `VersionList`, update union types |
| `cli/versions.ts` | Add to `SYMLINK_NODE_BINDINGS` array |
| `helpers/sdk-compat.ts` | Add compat wrappers if APIs changed |

## Quick Reference: Commands

```bash
# 1. Verify current tests pass
yarn versions && yarn test performance --env dev --versions 3

# 2. After making changes, install and link
yarn install && yarn versions

# 3. Test new version only
yarn test performance --env dev --versions 1

# 4. Full regression
yarn regression
```
