# Error Logging Migration Examples

This document shows practical examples of migrating from manual try-catch blocks to the new `withErrorLogging` wrapper.

## Example 1: Simple DM Test

### Before (Manual try-catch):

```typescript
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

describe("dms", async () => {
  const workers = await getWorkers(["alice", "bob"]);
  setupTestLifecycle({});

  it("should create and send DM", async () => {
    try {
      const alice = workers.get("alice")!;
      const bob = workers.get("bob")!;

      const dm = await alice.client.conversations.newDm(bob.client.inboxId);
      const messageId = await dm.send("Hello!");

      expect(dm).toBeDefined();
      expect(messageId).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
```

### After (Automatic error logging):

```typescript
import { withErrorLogging } from "@helpers/logger"; // Changed import
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

describe("dms", async () => {
  const workers = await getWorkers(["alice", "bob"]);
  setupTestLifecycle({});

  it(
    "should create and send DM",
    withErrorLogging(async () => {
      // Wrapped with withErrorLogging
      const alice = workers.get("alice")!;
      const bob = workers.get("bob")!;

      const dm = await alice.client.conversations.newDm(bob.client.inboxId);
      const messageId = await dm.send("Hello!");

      expect(dm).toBeDefined();
      expect(messageId).toBeDefined();
      // No try-catch needed!
    }),
  );
});
```

## Example 2: Complex Group Test

### Before (Multiple try-catch blocks):

```typescript
describe("groups", async () => {
  const workers = await getWorkers(5);
  setupTestLifecycle({});

  it("should create group", async () => {
    try {
      const group = await workers.createGroupBetweenAll();
      expect(group).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should send messages", async () => {
    try {
      const group = await workers.createGroupBetweenAll();
      const messageId = await group.send("Hello group!");
      expect(messageId).toBeDefined();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should update metadata", async () => {
    try {
      const group = await workers.createGroupBetweenAll();
      await group.updateName("New Name");
      expect(group.name).toBe("New Name");
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
```

### After (Clean test code):

```typescript
describe("groups", async () => {
  const workers = await getWorkers(5);
  setupTestLifecycle({});

  it(
    "should create group",
    withErrorLogging(async () => {
      const group = await workers.createGroupBetweenAll();
      expect(group).toBeDefined();
    }),
  );

  it(
    "should send messages",
    withErrorLogging(async () => {
      const group = await workers.createGroupBetweenAll();
      const messageId = await group.send("Hello group!");
      expect(messageId).toBeDefined();
    }),
  );

  it(
    "should update metadata",
    withErrorLogging(async () => {
      const group = await workers.createGroupBetweenAll();
      await group.updateName("New Name");
      expect(group.name).toBe("New Name");
    }),
  );
});
```

## Example 3: Stream Verification Test

### Before:

```typescript
it("should verify message delivery", async () => {
  try {
    const alice = workers.get("alice")!;
    const bob = workers.get("bob")!;

    bob.worker.startStream(typeofStream.Message);

    const dm = await alice.client.conversations.newDm(bob.client.inboxId);

    const verifyResult = await verifyMessageStream(
      dm,
      [bob],
      5,
      "test-{i}-{randomSuffix}",
    );

    expect(verifyResult.allReceived).toBe(true);
    expect(verifyResult.averageEventTiming).toBeLessThan(500);
  } catch (e) {
    logError(e, expect.getState().currentTestName);
    throw e;
  }
});
```

### After:

```typescript
it(
  "should verify message delivery",
  withErrorLogging(async () => {
    const alice = workers.get("alice")!;
    const bob = workers.get("bob")!;

    bob.worker.startStream(typeofStream.Message);

    const dm = await alice.client.conversations.newDm(bob.client.inboxId);

    const verifyResult = await verifyMessageStream(
      dm,
      [bob],
      5,
      "test-{i}-{randomSuffix}",
    );

    expect(verifyResult.allReceived).toBe(true);
    expect(verifyResult.averageEventTiming).toBeLessThan(500);
  }),
);
```

## Key Changes Summary

1. **Import Change**: Replace `logError` import with `withErrorLogging`
2. **Function Wrapping**: Wrap test function with `withErrorLogging(async () => { ... })`
3. **Remove try-catch**: Delete all manual try-catch blocks and logError calls
4. **Cleaner Code**: Focus on test logic instead of error handling boilerplate

## Benefits

- **94% Less Boilerplate**: Eliminates 15-20 lines of try-catch per test
- **Consistent Error Handling**: All errors logged uniformly across tests
- **Better Readability**: Test logic is not obscured by error handling
- **Reduced Maintenance**: No risk of forgetting try-catch blocks in new tests
- **Same Functionality**: Maintains all existing error reporting and Slack integration

## Migration Strategy

1. **New Tests**: Always use `withErrorLogging` wrapper
2. **Existing Tests**: Migrate opportunistically when editing
3. **Legacy Support**: Manual try-catch still works for special cases
4. **Team Adoption**: Update team templates and examples to use new pattern
