# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XMTP QA Tools is a comprehensive testing and monitoring suite for the XMTP protocol. It tests the Node SDK's Napi binding through LibXMTP, focusing on DMs, groups, streams, sync, consent, client operations, and agent interactions.

## Commands

```bash
# Build, format, and lint
yarn c                          # Format + build + lint (full check)
yarn build                      # TypeScript compilation only
yarn format                     # Prettier formatting
yarn lint                       # ESLint

# Testing
yarn test <suite>               # Run test suite (e.g., yarn test performance)
yarn test <suite> --env dev     # Specify environment (dev, production, local)
yarn test <suite> --no-fail --log warn --file  # Debug mode with file logging
yarn regression                 # Regression tests across SDK versions

# SDK version management
yarn versions                   # Link SDK versions (creates symlinks)

# Bots and utilities
yarn bot                        # Run interactive bots
yarn gen                        # Generate test data
yarn agent-versions            # Show agent versions
```

## Architecture

### Worker-based Testing Framework

Tests use a `WorkerManager` pattern where each worker has an isolated XMTP client with separate database:

```typescript
import { verifyMessageStream } from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";

const workers = await getWorkers(["alice", "bob"]); // Named workers
const workers = await getWorkers(5); // Random workers
const workers = await getWorkers(5, { randomNames: false }); // Fixed names

// Access patterns
workers.get("alice"); // Specific worker
workers.getCreator(); // First worker
workers.getReceiver(); // Random non-creator
workers.getAllButCreator(); // All except first
workers.createGroupBetweenAll("Group Name"); // Create group with all workers
```

### Multi-version SDK Support

Supports testing across multiple Node SDK versions (4.3.0-5.1.1) for backward compatibility. Versions are mapped in `versions/node-sdk.ts` with npm aliases allowing multiple versions installed simultaneously.

**Compat layer:** SDK API names changed across versions (e.g., `newGroup` → `createGroup`, `newDm` → `createDm`). Tests should use `worker.worker.createGroup()` / `worker.worker.createDm()` / `worker.worker.fetchInboxState()` instead of direct `client.conversations.*` calls, so tests work across all supported SDK versions. The compat wrappers live in `helpers/sdk-compat.ts`.

**Upgrade procedure:** Update `package.json` with aliased package, add import to `versions/node-sdk.ts`, run `yarn versions` to link, run `yarn regression` to verify.

### Key Path Aliases

- `@helpers` - Shared testing utilities (client, streams, logger, vitest)
- `@workers` - Worker management and SDK version handling
- `@versions` - SDK version imports
- `@agents` - Agent SDK implementations
- `@inboxes` - Test inbox management

### Stream Verification Pattern

```typescript
import { verifyMessageStream } from "@helpers/streams";
import { typeofStream } from "@workers/main";

// Start streams before sending
workers.getReceiver().worker.startStream(typeofStream.Message);

const result = await verifyMessageStream(
  conversation,
  [receivers],
  messageCount,
  "template-{i}-{randomSuffix}",
);

expect(result.receptionPercentage).toBeGreaterThanOrEqual(99);
expect(result.averageEventTiming).toBeLessThan(500);
```

### XMTP Client Operations

Use the version-compatible worker methods for DM/group creation and inbox state:

```typescript
// DM creation (version-compatible)
const dm = await alice.worker.createDm(bob.client.inboxId);

// Group creation (version-compatible)
const group = await alice.worker.createGroup([...inboxIds]);
const group2 = await alice.worker.createGroup([...inboxIds], {
  groupName: "My Group",
});

// Inbox state (version-compatible)
const state = await alice.worker.fetchInboxState();

// Messaging
await dm.sendText("Hello");
await group.sendText("Hello group");

// Group admin management
const admins = group.listAdmins();
const superAdmins = group.listSuperAdmins();
await group.addAdmin(inboxId);
await group.addSuperAdmin(inboxId);
```

## Test Structure

Tests live in `monitoring/` directory with 100-minute timeout (single-threaded via Vitest). Always call `setupDurationTracking({ testName })` for proper cleanup.

```typescript
describe(testName, async () => {
  const workers = await getWorkers(["alice", "bob"]);
  setupDurationTracking({ testName });

  it("should test something", async () => {
    // Test logic
  });
});
```

## Environment

- `XMTP_ENV`: dev | production | local | multinode
- `LOGGING_LEVEL`: Rust library log level (error, warn, info)
- `LOG_LEVEL`: JS log level

Endpoints:

- local: `http://localhost:5556`
- dev: `https://grpc.dev.xmtp.network:443`
- production: `https://grpc.production.xmtp.network:443`

## XMTP Agent SDK (for bots in agents/)

Event-driven middleware pattern:

```typescript
import { Agent, filter } from "@xmtp/agent-sdk";

const agent = await Agent.createFromEnv();

agent.on("text", async (ctx) => {
  if (filter.isText(ctx.message)) {
    await ctx.sendText("Response");
  }
});

agent.on("group", async (ctx) => {
  await ctx.sendText("Hello group!");
});

await agent.start();
```

Key events: `text`, `attachment`, `reaction`, `reply`, `dm`, `group`, `message`

## XMTP Identifiers

- **Ethereum Address**: `0x` + 40 hex chars
- **Private Key**: `0x` + 64 hex chars
- **Encryption Key**: 64 hex chars (no prefix)
- **Inbox ID**: 64 hex chars (no prefix)
- **Installation ID**: 64 hex chars (no prefix)
