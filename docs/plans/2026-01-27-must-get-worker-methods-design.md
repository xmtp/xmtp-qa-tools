# Add `mustGet` Methods to WorkerManager

**Status:** Completed

## Problem

The codebase has 50+ non-null assertions (`!`) when accessing workers, clients, groups, and DMs. These hide bugs that only surface at runtime with cryptic errors like "Cannot read property 'client' of undefined".

Examples:

```typescript
const clientSingleSync = singleSyncWorkers.get(randomName)!.client;
await creator!.client.conversations.sync();
const result = await dm!.sendText("hello");
```

## Solution

### 1. Fix Return Types on Existing Methods

`getCreator()` and `getReceiver()` currently claim to return `Worker` but can return `undefined` when accessing an empty array. Fix the types to reflect reality:

```typescript
getCreator(): Worker | undefined
getReceiver(): Worker | undefined
```

### 2. Add Throwing Variants

Add three new methods that throw descriptive errors instead of returning undefined:

```typescript
mustGet(baseName: string | number, installationId?: string): Worker {
  const worker = this.get(baseName, installationId);
  if (!worker) {
    throw new Error(`Worker "${baseName}" not found`);
  }
  return worker;
}

mustGetCreator(): Worker {
  const worker = this.getCreator();
  if (!worker) {
    throw new Error("No workers available");
  }
  return worker;
}

mustGetReceiver(): Worker {
  const worker = this.getReceiver();
  if (!worker) {
    throw new Error("No receiver available");
  }
  return worker;
}
```

### 3. Migrate Test Files

Update all test files to:

1. Type local variables as non-optional (`let creator: Worker` not `let creator: Worker | undefined`)
2. Use `mustGet` in `beforeAll` blocks for validation
3. Remove all `!` assertions

**Before:**

```typescript
let creator: Worker | undefined;

beforeAll(async () => {
  const workers = await getWorkers(["alice", "bob"]);
  creator = workers.get("alice");
});

it("test", async () => {
  await creator!.client.conversations.sync();
});
```

**After:**

```typescript
let creator: Worker;

beforeAll(async () => {
  const workers = await getWorkers(["alice", "bob"]);
  creator = workers.mustGet("alice");
});

it("test", async () => {
  await creator.client.conversations.sync();
});
```

## Files to Modify

### Core (1 file)

- `workers/manager.ts`

### Test Files (10 files)

1. `monitoring/bugs/stitch.test.ts`
2. `monitoring/bugs/verifyallinstalls.test.ts`
3. `monitoring/browser/browser.test.ts`
4. `monitoring/networkchaos/node-blackhole.test.ts`
5. `monitoring/networkchaos/dm-duplicate-prevention.test.ts`
6. `monitoring/networkchaos/group-client-partition.test.ts`
7. `monitoring/networkchaos/group-partition-delayedreceive.test.ts`
8. `monitoring/networkchaos/group-reconciliation.test.ts`
9. `monitoring/performance.test.ts`
10. `measurements/perf-matrix.test.ts`

## Implementation Notes

- Dynamic worker names like `workers.get(workerNames[0])!` become `workers.mustGet(workerNames[0])`
- Mid-test worker creation with `getWorkers([randomName])` uses the same `mustGet` pattern
- Update `IWorkerManager` interface to include new methods and corrected return types
