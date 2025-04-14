# Chaos fork testing in XMTP

This test is designed to test the robustness of the XMTP group protocol under various failure conditions.

## Key helper methods

```typescript
// Creates unpredictable network conditions for realistic testing
setRandomNetworkConditions(testConfig.workers);

// Performs intentionally inconsistent syncs across workers
await randomSyncs({
  workers: testConfig.workers as WorkerManager,
  groupId: testConfig.groupId as string,
});

// Adds members to groups with potential failures
await addMemberByWorker(globalGroup.id, bobWorker?.client.inboxId, fabri);

// Sends messages with count tracking to verify consistency
messageCount = await sendMessageWithCount(
  bobWorker,
  globalGroup.id,
  messageCount,
);

// Assigns admin privileges with potential permission errors
await randomlyAsignAdmins(globalGroup);

// Removes members with potential race conditions
await removeMemberByWorker(globalGroup.id, ivy?.client.inboxId, bobWorker);

// Randomly clears DB data to test recovery scenarios
await randomlyRemoveDb(testConfig.workers as WorkerManager);
```

## Test workflows

For each core operation, we run multiple iterations with random failure injections:

1. **Group creation**: Tests ability to create consistent groups despite failures
2. **Member addition**: Verifies that member additions succeed or fail cleanly
3. **Message sending**: Ensures messages are consistently delivered or cleanly fail
4. **Metadata changes**: Tests group name/description updates with failures
5. **Member removal**: Verifies clean member removal despite failures
6. **Admin assignment**: Tests permission changes with potential failures
