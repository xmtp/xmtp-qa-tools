# mustGet Worker Methods Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add throwing variants of worker accessor methods and migrate all test files to eliminate non-null assertions.

**Architecture:** Add `mustGet`, `mustGetCreator`, and `mustGetReceiver` methods to WorkerManager that throw descriptive errors instead of returning undefined. Fix return types on `getCreator` and `getReceiver` to accurately reflect they can return undefined. Update all test files to use these methods and remove `!` assertions.

**Tech Stack:** TypeScript, Vitest

---

## Task 1: Update IWorkerManager Interface

**Files:**
- Modify: `workers/manager.ts:29-63`

**Step 1: Update the interface with corrected types and new methods**

Replace lines 29-63 with:

```typescript
interface IWorkerManager {
  // Lifecycle Management
  terminateAll(deleteDbs?: boolean): Promise<void>;

  getAll(): Worker[];
  get(baseName: string | number, installationId?: string): Worker | undefined;
  mustGet(baseName: string | number, installationId?: string): Worker;
  getRandomWorkers(count: number): Worker[];
  getRandomWorker(): Worker | undefined;
  getCreator(): Worker | undefined;
  mustGetCreator(): Worker;
  getReceiver(): Worker | undefined;
  mustGetReceiver(): Worker;
  getAllButCreator(): Worker[];

  // Worker Creation & Management
  addWorker(baseName: string, installationId: string, worker: Worker): void;
  createWorker(descriptor: string, apiUrl?: string): Promise<Worker>;

  checkForks(): Promise<void>;
  checkForksForGroup(groupId: string): Promise<bigint>;
  printWorkers(): Promise<void>;

  // Installation Management
  revokeExcessInstallations(threshold?: number): Promise<void>;

  // CLI & Configuration
  checkCLI(): void;

  // Streaming
  startStream(streamType: typeofStream): void;

  // Group Operations
  createGroupBetweenAll(
    groupName?: string,
    extraMembers?: string[],
  ): Promise<Group>;
}
```

**Step 2: Verify TypeScript compiles**

Run: `yarn build`
Expected: Compilation errors about missing methods (expected at this stage)

**Step 3: Commit**

```bash
git add workers/manager.ts
git commit -m "chore: update IWorkerManager interface with mustGet methods and corrected types"
```

---

## Task 2: Fix getCreator and getReceiver Return Types

**Files:**
- Modify: `workers/manager.ts:251-261`

**Step 1: Update getCreator return type**

Replace lines 251-254:

```typescript
  getCreator(): Worker | undefined {
    const workers = this.getAll();
    return workers[0];
  }
```

**Step 2: Update getReceiver return type**

Replace lines 256-261:

```typescript
  getReceiver(): Worker | undefined {
    const workers = this.getAll();
    const creator = this.getCreator();
    const otherWorkers = workers.filter((worker) => worker !== creator);
    return otherWorkers[Math.floor(Math.random() * otherWorkers.length)];
  }
```

**Step 3: Update getRandomWorker return type**

Replace lines 150-153:

```typescript
  public getRandomWorker(): Worker | undefined {
    const allWorkers = this.getAll();
    return allWorkers[Math.floor(Math.random() * allWorkers.length)];
  }
```

**Step 4: Verify TypeScript compiles**

Run: `yarn build`
Expected: Compilation errors in places using these methods (expected)

**Step 5: Commit**

```bash
git add workers/manager.ts
git commit -m "fix: correct return types for getCreator, getReceiver, getRandomWorker"
```

---

## Task 3: Add mustGet, mustGetCreator, mustGetReceiver Methods

**Files:**
- Modify: `workers/manager.ts` (add after line 327, after the `get` method)

**Step 1: Add the three new methods**

Add after the closing brace of the `get` method (after line 327):

```typescript

  /**
   * Gets a specific worker by name, throwing if not found
   */
  public mustGet(
    baseName: string | number,
    installationId?: string,
  ): Worker {
    const worker = this.get(baseName, installationId);
    if (!worker) {
      throw new Error(`Worker "${baseName}" not found`);
    }
    return worker;
  }

  /**
   * Gets the creator (first worker), throwing if no workers exist
   */
  public mustGetCreator(): Worker {
    const worker = this.getCreator();
    if (!worker) {
      throw new Error("No workers available");
    }
    return worker;
  }

  /**
   * Gets a receiver (random non-creator), throwing if insufficient workers
   */
  public mustGetReceiver(): Worker {
    const worker = this.getReceiver();
    if (!worker) {
      throw new Error("No receiver available");
    }
    return worker;
  }
```

**Step 2: Verify TypeScript compiles**

Run: `yarn build`
Expected: PASS (interface now satisfied)

**Step 3: Commit**

```bash
git add workers/manager.ts
git commit -m "feat: add mustGet, mustGetCreator, mustGetReceiver methods"
```

---

## Task 4: Fix Internal Usage in WorkerManager

**Files:**
- Modify: `workers/manager.ts:266-278` (createGroupBetweenAll method)

**Step 1: Update createGroupBetweenAll to use mustGetCreator**

The `createGroupBetweenAll` method calls `getCreator()` which now returns `Worker | undefined`. Update it:

Replace lines 262-278:

```typescript
  async createGroupBetweenAll(
    groupName: string = `Test Group ${Math.random().toString(36).substring(2, 15)}`,
    extraMembers: string[] = [],
  ): Promise<Group> {
    const creator = this.mustGetCreator();
    const memberList = this.getAllButCreator().map(
      (worker) => worker.client.inboxId,
    );
    const group = await creator.client.conversations.createGroup(memberList, {
      groupName,
    });
    if (extraMembers.length > 0) {
      await group.addMembers(extraMembers);
    }

    return group as Group;
  }
```

**Step 2: Update getAllButCreator to handle undefined creator**

Replace lines 280-284:

```typescript
  getAllButCreator(): Worker[] {
    const workers = this.getAll();
    const creator = this.getCreator();
    if (!creator) {
      return workers;
    }
    return workers.filter((worker) => worker.name !== creator.name);
  }
```

**Step 3: Verify TypeScript compiles**

Run: `yarn build`
Expected: PASS

**Step 4: Commit**

```bash
git add workers/manager.ts
git commit -m "fix: update internal WorkerManager methods to handle undefined"
```

---

## Task 5: Migrate monitoring/bugs/stitch.test.ts

**Files:**
- Modify: `monitoring/bugs/stitch.test.ts`

**Step 1: Replace .get()! with .mustGet()**

Replace lines 10-12:

```typescript
  it("create a group", async () => {
    const workers = await getWorkers(["henry", "john"]);
    const creator = workers.mustGet("henry");
    const receiver = workers.mustGet("john");
```

**Step 2: Verify TypeScript compiles**

Run: `yarn build`
Expected: PASS

**Step 3: Commit**

```bash
git add monitoring/bugs/stitch.test.ts
git commit -m "refactor: use mustGet in stitch.test.ts"
```

---

## Task 6: Migrate monitoring/bugs/verifyallinstalls.test.ts

**Files:**
- Modify: `monitoring/bugs/verifyallinstalls.test.ts`

**Step 1: Read the file and identify patterns**

Run: Search for `!` assertions and `.get(` patterns

**Step 2: Replace all .get()! with .mustGet() and creator!/receiver! with proper typing**

**Step 3: Verify TypeScript compiles**

Run: `yarn build`
Expected: PASS

**Step 4: Commit**

```bash
git add monitoring/bugs/verifyallinstalls.test.ts
git commit -m "refactor: use mustGet in verifyallinstalls.test.ts"
```

---

## Task 7: Migrate monitoring/browser/browser.test.ts

**Files:**
- Modify: `monitoring/browser/browser.test.ts`

**Step 1: Read the file and identify patterns**

**Step 2: Replace all .get()! with .mustGet()**

**Step 3: Verify TypeScript compiles**

Run: `yarn build`
Expected: PASS

**Step 4: Commit**

```bash
git add monitoring/browser/browser.test.ts
git commit -m "refactor: use mustGet in browser.test.ts"
```

---

## Task 8: Migrate monitoring/networkchaos/node-blackhole.test.ts

**Files:**
- Modify: `monitoring/networkchaos/node-blackhole.test.ts`

**Step 1: Read the file and identify patterns**

**Step 2: Replace all .get()! with .mustGet()**

**Step 3: Verify TypeScript compiles**

Run: `yarn build`
Expected: PASS

**Step 4: Commit**

```bash
git add monitoring/networkchaos/node-blackhole.test.ts
git commit -m "refactor: use mustGet in node-blackhole.test.ts"
```

---

## Task 9: Migrate monitoring/networkchaos/dm-duplicate-prevention.test.ts

**Files:**
- Modify: `monitoring/networkchaos/dm-duplicate-prevention.test.ts`

**Step 1: Read the file and identify patterns**

**Step 2: Replace all .get()! with .mustGet()**

**Step 3: Verify TypeScript compiles**

Run: `yarn build`
Expected: PASS

**Step 4: Commit**

```bash
git add monitoring/networkchaos/dm-duplicate-prevention.test.ts
git commit -m "refactor: use mustGet in dm-duplicate-prevention.test.ts"
```

---

## Task 10: Migrate monitoring/networkchaos/group-client-partition.test.ts

**Files:**
- Modify: `monitoring/networkchaos/group-client-partition.test.ts`

**Step 1: Read the file and identify patterns**

**Step 2: Replace all .get()! with .mustGet()**

**Step 3: Verify TypeScript compiles**

Run: `yarn build`
Expected: PASS

**Step 4: Commit**

```bash
git add monitoring/networkchaos/group-client-partition.test.ts
git commit -m "refactor: use mustGet in group-client-partition.test.ts"
```

---

## Task 11: Migrate monitoring/networkchaos/group-partition-delayedreceive.test.ts

**Files:**
- Modify: `monitoring/networkchaos/group-partition-delayedreceive.test.ts`

**Step 1: Read the file and identify patterns**

**Step 2: Replace all .get()! with .mustGet()**

**Step 3: Verify TypeScript compiles**

Run: `yarn build`
Expected: PASS

**Step 4: Commit**

```bash
git add monitoring/networkchaos/group-partition-delayedreceive.test.ts
git commit -m "refactor: use mustGet in group-partition-delayedreceive.test.ts"
```

---

## Task 12: Migrate monitoring/networkchaos/group-reconciliation.test.ts

**Files:**
- Modify: `monitoring/networkchaos/group-reconciliation.test.ts`

**Step 1: Replace all .get()! with .mustGet()**

Lines to change:
- Line 27-29: `workers.get("user1")!` -> `workers.mustGet("user1")`
- Line 89-91: `workers.get("user4")!` -> `workers.mustGet("user4")`
- Line 124-126: `workers.get("user4")!` -> `workers.mustGet("user4")`
- Line 140-142: `workers.get("user3")!` -> `workers.mustGet("user3")`
- Line 150: `workers.get("user4")!` -> `workers.mustGet("user4")`

**Step 2: Verify TypeScript compiles**

Run: `yarn build`
Expected: PASS

**Step 3: Commit**

```bash
git add monitoring/networkchaos/group-reconciliation.test.ts
git commit -m "refactor: use mustGet in group-reconciliation.test.ts"
```

---

## Task 13: Migrate monitoring/performance.test.ts

**Files:**
- Modify: `monitoring/performance.test.ts`

This file has the most changes. Key patterns:

1. **Variable declarations (lines 56-58):** Change from `Worker | undefined` to `Worker`
2. **beforeAll validation (lines 60-68):** Use `mustGetCreator()` and `mustGetReceiver()`
3. **Remove all `creator!`, `receiver!`, `dm!` assertions** throughout the file
4. **Line 250, 260, 271, 283:** Change `singleSyncWorkers.get(randomName)!` to `singleSyncWorkers.mustGet(randomName)`
5. **Line 146:** Change `allMembersWithExtra.at(-1)!` - this stays as-is (array access, not WorkerManager)

**Step 1: Update variable declarations**

Replace lines 56-58:

```typescript
  let workers: WorkerManager;
  let creator: Worker;
  let receiver: Worker;
  let dm: Dm;
```

**Step 2: Update beforeAll block**

Replace lines 60-68:

```typescript
  beforeAll(async () => {
    workers = await getWorkers(10);
    creator = workers.mustGetCreator();
    receiver = workers.mustGetReceiver();

    setCustomDuration(creator.initializationTime);
  });
```

**Step 3: Remove the null check in first test**

Replace lines 71-77:

```typescript
  it(`create: measure creating a client`, () => {
    setCustomDuration(creator.initializationTime);
  });
```

**Step 4: Remove all `!` assertions from creator, receiver, dm**

Replace throughout:
- `creator!` -> `creator`
- `receiver!` -> `receiver`
- `dm!` -> `dm`

**Step 5: Update mid-test worker creation**

Lines 249-250, 259-260, 270-271, 282-283:

```typescript
const clientSingleSync = singleSyncWorkers.mustGet(randomName).client;
```

**Step 6: Verify TypeScript compiles**

Run: `yarn build`
Expected: PASS

**Step 7: Commit**

```bash
git add monitoring/performance.test.ts
git commit -m "refactor: use mustGet in performance.test.ts"
```

---

## Task 14: Migrate measurements/perf-matrix.test.ts

**Files:**
- Modify: `measurements/perf-matrix.test.ts`

Similar patterns to performance.test.ts:

1. **Variable declarations (lines 63-64):** Change from `Worker | undefined` to `Worker`
2. **Worker initialization (lines 73-74):** Use `mustGet()`
3. **Remove all `creator!`, `receiver!`, `dm!` assertions** throughout

**Step 1: Update variable declarations**

Replace lines 63-64:

```typescript
    let creator: Worker;
    let receiver: Worker;
```

**Step 2: Update worker initialization**

Replace lines 73-74:

```typescript
      creator = workers.mustGet(workerNames[0]);
      receiver = workers.mustGet(workerNames[1]);
```

**Step 3: Remove all `!` assertions**

Replace throughout:
- `creator!` -> `creator`
- `receiver!` -> `receiver`
- `dm!` -> `dm`

**Step 4: Verify TypeScript compiles**

Run: `yarn build`
Expected: PASS

**Step 5: Commit**

```bash
git add measurements/perf-matrix.test.ts
git commit -m "refactor: use mustGet in perf-matrix.test.ts"
```

---

## Task 15: Final Verification

**Step 1: Run full build and lint**

Run: `yarn c`
Expected: PASS

**Step 2: Search for remaining `!` assertions on worker patterns**

Run: `grep -rn "\.get(.*)\!" --include="*.ts" monitoring/ measurements/`
Expected: No matches (or only non-worker patterns like array access)

**Step 3: Commit any remaining fixes**

If any issues found, fix and commit.

---

## Task 16: Update Design Document

**Files:**
- Modify: `docs/plans/2026-01-27-must-get-worker-methods-design.md`

**Step 1: Add "Completed" status**

Add at top of file after title:

```markdown
**Status:** Completed
```

**Step 2: Commit**

```bash
git add docs/plans/2026-01-27-must-get-worker-methods-design.md
git commit -m "docs: mark mustGet design as completed"
```
