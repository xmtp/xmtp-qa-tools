# Workers

The `getWorkers` function has three input modes with optional configuration:

### Input Modes

```typescript
// 1. Number - creates that many workers with random names (default)
workers = await getWorkers(5);

// 2. Array of specific worker names
workers = await getWorkers(["alice", "bob", "charlie"]);
```

### Options Configuration

```typescript
type GetWorkersOptions = {
  env?: XmtpEnv; // XMTP environment (default: from XMTP_ENV)
  randomNames?: boolean; // Use random names for number input (default: true)
};

// Examples:
await getWorkers(3); // 3 workers with random names, versioned
await getWorkers(3, { randomNames: false }); // 3 workers with fixed names (bob, alice, fabri)
await getWorkers(["alice", "bob"]); // Specific names, versioned
await getWorkers(["alice", "bob"], {}); // Specific names, no versioning
await getWorkers(5, { env: "production" }); // 5 random workers on production
```

## Worker Access Patterns

```typescript
// Get specific workers
const alice = workers.get("alice");
const bob = workers.get("bob");

// Access worker properties
alice.client; // XMTP client
alice.worker; // Worker thread
alice.name; // "alice"
alice.address; // Ethereum address
alice.client.inboxId; // Inbox ID

// Utility methods
workers.getCreator(); // First worker
workers.getReceiver(); // Random non-creator
workers.getAll(); // All workers array
workers.getAllButCreator(); // All except first
workers.getRandomWorkers(2); // Random subset

// Get worker names array (useful for logging/debugging)
const names = getWorkerNames(workers); // ["alice", "bob", "charlie"]
```

## Common Usage Patterns

### Simple Testing

```tsx
// Most common patterns
let workers = await getWorkers(5); // 5 random workers
workers = await getWorkers(["alice", "bob"]); // Specific workers
```

### Version Testing

```tsx
// Versioning is enabled by default
workers = await getWorkers(3); // Uses random SDK versions
workers = await getWorkers(3, {}); // All latest version
```

### Environment-Specific Testing

```tsx
workers = await getWorkers(5, { env: "production" });
workers = await getWorkers(["alice"], { env: "local" });
```
