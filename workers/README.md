# Workers

Workers in our testing framework allow you to create predefined personas (like Alice, Bob, etc.) with different installations. This is useful for testing multi-device scenarios or different client configurations.

## Basic usage

The simplest way to create workers is to use the `getWorkers` function:

```typescript
// Initialize workers
const workers = await getWorkers(["alice", "bob"], testName);

// Access workers directly
const alice = workers.get("alice"); // "a" is the default installation
const bob = workers.get("bob"); // "a" is the default installation

// Use them in your tests
const conversation = await alice.client.conversations.newDm(bob.client.inboxId);
await conversation.send("Hello from Alice to Bob");
```

#### Considerations:

- If a persona doesn't exist, its keys are automatically created
- Existing personas use keys from the env file and .data folder
- Missing data folders are created automatically
- Personas with the "random" prefix have keys stored only in memory

> [!TIP]
> Access our repository of 600 dummy wallets with inboxIds in the [generated-inboxes.json](./helpers/generated-inboxes.json) file

## Working with multiple installations

You can create different installations of the same persona to simulate multiple devices:

```typescript
// Create primary personas with default installation
const primaryWorkers = await getWorkers(["alice", "bob"], testName);

// Create secondary installations
const secondaryWorkers = await getWorkers(
  ["alice-desktop", "bob-mobile"],
  testName,
);

// Access specific installations
const aliceDefault = primaryWorkers.get("alice");
const aliceDesktop = secondaryWorkers.get("alice", "desktop");
const bobMobile = secondaryWorkers.get("bob", "mobile");
```

## Key features

- **Shared identity**: Different installations of the same persona share the same identity (inboxId)
- **Separate storage**: Each installation has its own database path
- **On-demand creation**: Create personas only when needed in your tests

## Example: Testing multi-device scenario

```typescript
// Create primary workers
const primaryWorkers = await getWorkers(["alice", "bob"], testName);

// Create a desktop installation for Alice
const secondaryWorkers = await getWorkers(["alice-desktop"], testName);
const aliceDesktop = secondaryWorkers.get("alice", "desktop");

// Send a message from Alice's desktop
const conversation = await aliceDesktop.client.conversations.newDm(
  primaryWorkers.get("bob").client.inboxId,
);
await conversation.send("Hello from Alice's desktop");

// Bob can see the message after syncing
await primaryWorkers.get("bob").client.conversations.syncAll();
const bobConversations = await primaryWorkers
  .get("bob")
  .client.conversations.list();
```

## Start workers with numbers

```typescript
const workers = await getWorkers(4, testName);
// this will start 4 workers with listed from the default names
```

## Pick one from default names

The default names are:

```typescript
import { defaultNames } from "@helpers/types";
```

```typescript
// Default personas as an enum
const defaultNames = [
  "bob",
  "alice",
  "fabri",
  "bot",
  "elon",
  "joe",
  "charlie",
  "dave",
  "rosalie",
  "eve",
  "frank",
  "grace",
  "henry",
  "ivy",
  "jack",
  "karen",
  "larry",
  "mary",
  "nancy",
  "oscar",
  "paul",
  "quinn",
  "rachel",
  "steve",
  "tom",
  "ursula",
  "victor",
  "wendy",
  "xavier",
  "yolanda",
  "zack",
  "adam",
  "bella",
  "carl",
  "diana",
  "eric",
  "fiona",
  "george",
  "hannah",
  "ian",
  "julia",
  "keith",
  "lisa",
  "mike",
  "nina",
  "oliver",
  "penny",
  "quentin",
  "rosa",
  "sam",
  "tina",
  "uma",
  "vince",
  "walt",
  "xena",
  "yara",
  "zara",
  "guada",
  //max 61
];
```

## Cleanup

Always clean up your personas after tests:

```typescript
afterAll(async () => {
  await closeEnv(testName, allPersonas);
});
```

This pattern allows you to test complex multi-device scenarios while maintaining clean separation between test environments.
