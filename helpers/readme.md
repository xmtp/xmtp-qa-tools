# Helpers documentation

This document provides practical instructions for using the helper modules in the `/helpers` directory.

## Client helper

The `client.ts` module provides utilities for creating and managing XMTP clients.

```typescript
import { createClient, createRandomClient } from "@helpers/client";

// Create a client with an existing private key
const client = await createClient(privateKey);

// Create a random client for testing
const randomClient = await createRandomClient();
```

**Expected result:** You'll get configured XMTP client instances ready for messaging operations.

## Datadog helper

The `datadog.ts` module provides utilities for sending metrics and logs to Datadog.

```typescript
import { logEvent, sendPerformanceMetric } from "@helpers/datadog";

// Send a metric to Datadog
await sendPerformanceMetric("test.metric", 1, ["tag:value"]);

// Send delivery metric
await ...

// Log an event to Datadog
await logEvent("Test event", "Event description", ["tag:value"]);
```

**Expected result:** Metrics and events will be sent to your Datadog account for monitoring.

## Group helper

The `group.ts` module provides utilities for working with XMTP group conversations.

```typescript
import { addMemberToGroup, createGroup } from "@helpers/group";

// Create a new group
const group = await createGroup(client, "Group name");

// Add a member to a group
await addMemberToGroup(group, memberAddress);
```

**Expected result:** You'll be able to create and manage XMTP group conversations.

## Logger helper

The `logger.ts` module provides structured logging capabilities.

```typescript
import { logger } from "@helpers/logger";

// Log information
logger.info("This is an info message", { context: "example" });

// Log errors
logger.error("This is an error message", { error: new Error("Example error") });
```

**Expected result:** Structured logs will be output according to the configured format and destinations.

## Verify helper

The `verify.ts` module provides utilities for verifying XMTP message delivery and content.

```typescript
import { verifyMessageContent, verifyMessageDelivery } from "@helpers/verify";

// Verify message delivery
await verifyMessageDelivery(sender, recipient, conversation);

// Verify message content
await verifyMessageContent(conversation, expectedContent);
```

**Expected result:** The functions will return verification results or throw errors if verification fails.

## Types

The `types.ts` file contains TypeScript type definitions used throughout the testing framework.

```typescript
import { ClientConfig, MessageOptions } from "@helpers/types";

// Use the types in your code
const config: ClientConfig = {
  env: "production",
  persistConversations: true,
};
```

**Expected result:** Proper TypeScript type checking for your testing code.

## Workers

The `workers/` directory contains utilities for running parallel operations with worker threads.

```typescript
import { WorkerFactory } from "@helpers/workers/factory";

// Create a worker factory
const factory = new WorkerFactory();

// Run a task in a worker thread
const result = await factory.runTask("taskName", taskData);
```

**Expected result:** Tasks will be executed in separate worker threads, improving performance for parallel operations.

## Generated inboxes

The `generated-inboxes.json` file contains previously generated test inboxes.

**Usage:** Reference this file in your tests when you need pre-generated XMTP accounts.

```typescript
import inboxes from "@helpers/generated-inboxes.json";

// Use a pre-generated inbox
const testInbox = inboxes[0];
const client = await createClient(testInbox.privateKey);
```
