# Workers

The `getWorkers` function has three input modes with optional configuration:

## Node SDK Version Management

### Upgrade procedure

When upgrading XMTP bindings and/or node-sdk versions:

1. Add `@xmtp/node-sdk-X.X.X` and `@xmtp/node-bindings-X.X.X` to package.json.
2. Add import for new SDK version to `versions/node-sdk.ts`.
3. Run `yarn regression` to check regression of latest 3 versions.
4. Create and Merge PR. (so it's tested in CI)

### Version mapping system

Versions are mapped in `versions/node-sdk.ts`:

```typescript
export const VersionList = [
  {
    Client: Client322,
    Conversation: Conversation322,
    Dm: Dm322,
    Group: Group322,
    nodeSDK: "3.2.2", // SDK version
    nodeBindings: "1.3.3", // Bindings version
    auto: true, // Include in automated testing
  },
];
```

### Package aliases

Multiple versions installed via npm aliases:

```json
{
  "dependencies": {
    "@xmtp/node-sdk-3.2.2": "npm:@xmtp/node-sdk@3.2.2",
    "@xmtp/node-bindings-1.3.3": "npm:@xmtp/node-bindings@1.3.3"
  }
}
```

### Dynamic linking

`yarn symlinks` creates symlinks:

```bash
node_modules/@xmtp/
├── node-sdk-3.2.2/
│   └── node_modules/@xmtp/
│       └── node-bindings -> ../../node-bindings-1.3.3/
└── node-bindings-1.3.3/
```

### Finding libxmtp version

The libxmtp commit hash is in:

```bash
node_modules/@xmtp/node-bindings-X.X.X/dist/version.json
```

### Using versions command to see current mappings

```bash
yarn symlinks
# shows current SDK → bindings mappings.
```

### Testing specific versions (automated)

```bash
yarn test performance --versions 3  # Test latest 3 auto-enabled versions
yarn test performance --nodeSDK 3.2.2 # custom version
yarn regression  # Vibe check on latest version
```

## Worker management

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
