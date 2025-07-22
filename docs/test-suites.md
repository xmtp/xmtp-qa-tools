# Test suites

We run a bunch of automated tests pretty much all the time to make sure XMTP works reliably. These aren't just basic smoke tests - we're talking about comprehensive validation across every SDK, environment, and use case that matters to real users.

## What we're testing

We've got 8 main categories of tests running continuously:

| Test Suite        | Purpose                    | Frequency     | Environments        | Coverage                             |
| ----------------- | -------------------------- | ------------- | ------------------- | ------------------------------------ |
| **Functional**    | Core protocol validation   | Every 3 hours | `dev`, `production` | DMs, groups, streams, sync, consent  |
| **Performance**   | Benchmarking and timing    | Every 30 min  | `dev`, `production` | SDK operations, latency, throughput  |
| **Delivery**      | Message reliability        | Every 30 min  | `dev`, `production` | Cross-platform delivery rates        |
| **Groups**        | Large-scale group testing  | Every 2 hours | `dev`, `production` | Group scaling up to 400 members      |
| **Agents**        | Bot and automation testing | Every 15 min  | `dev`, `production` | Agent responsiveness, uptime         |
| **Browser**       | Web environment validation | Every 30 min  | `dev`, `production` | Playwright automation, WASM binding  |
| **Network Chaos** | Resilience testing         | On-demand     | `dev`               | Network partition, latency injection |
| **Compatibility** | Cross-version testing      | Daily         | `dev`, `production` | SDK version compatibility            |

## 1. Functional test suite

### What we cover

- Direct messages
- Group conversations
- Message streaming
- Conversation sync
- Consent framework
- Content codecs
- Cross-platform compatibility
- Backward compatibility

#### Cross-platform compatibility

```typescript
test("Browser SDK to Node SDK message delivery", async () => {
  const browserClient = await createBrowserClient();
  const nodeClient = await createNodeClient();
  const conversation = await browserClient.conversations.newConversation(
    nodeClient.address,
  );
  await conversation.send("Hello from browser");
  const messages = await nodeClient.conversations
    .getConversation(browserClient.address)
    .messages();
  expect(messages).toContainMessage("Hello from browser");
});

test("React Native to Swift message delivery", async () => {
  const rnClient = await createReactNativeClient();
  const swiftClient = await createSwiftClient();

  const conversation = await rnClient.conversations.newConversation(
    swiftClient.address,
  );

  await conversation.send("Hello from React Native");

  // Verify delivery on Swift client
  const messages = await swiftClient.inbox.messages(conversation.id);
  expect(messages.last().text).toBe("Hello from React Native");
});
```

See [Workflows](./workflows.md) for automation details.

## 2. Performance test suite

### Key metrics

#### SDK operation timing

```typescript
test("Client creation performance", async () => {
  const startTime = performance.now();
  const client = await Client.create(wallet, { env: "dev" });
  const duration = performance.now() - startTime;
  await submitMetric("xmtp.sdk.client_creation_time", duration, {
    env: "dev",
    sdk_version: client.version,
  });
  expect(duration).toBeLessThan(5000);
});

test("Group message send performance", async () => {
  const group = await createGroup(50);
  const start = performance.now();

  await group.send("Benchmark message");

  const duration = performance.now() - start;
  await submitMetric("xmtp.group.send_time", duration, {
    group_size: 50,
  });

  expect(duration).toBeLessThan(2000);
});
```

See suites/bench for more.

### Performance targets

| Metric                | Target      | Alert Threshold |
| --------------------- | ----------- | --------------- |
| Client Creation       | <5 seconds  | >10 seconds     |
| Message Send          | <2 seconds  | >5 seconds      |
| Message Delivery      | <3 seconds  | >10 seconds     |
| Group Creation        | <10 seconds | >20 seconds     |
| Stream Initialization | <5 seconds  | >10 seconds     |

## 3. Delivery test suite

### Test scenarios

```typescript
test("dev to production message delivery", async () => {
  const devClient = await createClient({ env: "dev" });
  const prodClient = await createClient({ env: "production" });
  const conversation = await devClient.conversations.newConversation(
    prodClient.address,
  );
  const messageId = await conversation.send("Cross-env test message");
  await waitForDelivery(prodClient, messageId, { timeout: 30000 });
});
```

Multi-region and rate tracking in suites/metrics/delivery.

### Reliability targets

| Environment Pair         | Target Delivery Rate | Max Latency |
| ------------------------ | -------------------- | ----------- |
| dev ↔ dev               | 99.9%                | 2 seconds   |
| production ↔ production | 99.95%               | 3 seconds   |
| dev ↔ production        | 99.5%                | 5 seconds   |
| Cross-region             | 99.0%                | 10 seconds  |

## 4. Groups (large-scale) test suite

### Scale testing

```typescript
test("400 member group performance", async () => {
  const admin = await createClient();
  const members = await createMultipleClients(399);
  const group = await admin.conversations.newGroup(
    members.map((m) => m.address),
  );
  await group.send("Message to 400 members");
  const deliveryResults = await Promise.allSettled(
    members.map((member) =>
      waitForGroupMessage(member, group.id, "Message to 400 members"),
    ),
  );
  const successRate =
    deliveryResults.filter((r) => r.status === "fulfilled").length /
    members.length;
  expect(successRate).toBeGreaterThan(0.95);
});
```

Operations at scale in suites/metrics/large.

### Performance characteristics

| Group Size  | Creation Time | Message Delivery | Success Rate |
| ----------- | ------------- | ---------------- | ------------ |
| 10 members  | <5 seconds    | <5 seconds       | 99.9%        |
| 50 members  | <15 seconds   | <10 seconds      | 99.5%        |
| 100 members | <30 seconds   | <20 seconds      | 99.0%        |
| 400 members | <60 seconds   | <45 seconds      | 95.0%        |

## 5. Agents test suite

### Agent monitoring

```typescript
test("GM bot responsiveness", async () => {
  const testClient = await createClient();
  const conversation = await testClient.conversations.newConversation(
    "0x937C0d4a6294cdfa575de17382c7076b579DC176",
  );
  const messageTime = Date.now();
  await conversation.send("health check");
  const response = await waitForResponse(conversation, {
    timeout: 10000,
    expectedContent: "hi",
  });
  const responseTime = Date.now() - messageTime;
  await submitMetric("xmtp.agent.response_time", responseTime, {
    agent: "gm-bot",
    env: process.env.XMTP_ENV,
  });
  expect(responseTime).toBeLessThan(5000);
});
```

Monitored agents in suites/agents.

## 6. Browser test suite

### Browser automation

```typescript
test("Browser SDK conversation flow", async ({ page }) => {
  await page.goto("https://xmtp.chat");
  await page.click('[data-testid="connect-wallet"]');
  await connectMetaMask(page);
  await page.click('[data-testid="connect-xmtp"]');
  await signXMTPMessages(page);
  await page.fill('[data-testid="new-conversation-input"]', testAddress);
  await page.click('[data-testid="start-conversation"]');
  await page.fill('[data-testid="message-input"]', "Browser test message");
  await page.click('[data-testid="send-message"]');
  await expect(page.locator('[data-testid="message"]')).toContainText(
    "Browser test message",
  );
});
```

WASM performance in suites/browser.

### Browser-specific metrics

| Browser | Client Creation | Message Send | Stream Init | Memory Usage |
| ------- | --------------- | ------------ | ----------- | ------------ |
| Chrome  | <3 seconds      | <2 seconds   | <2 seconds  | <50MB        |
| Firefox | <4 seconds      | <2 seconds   | <3 seconds  | <60MB        |
| Safari  | <4 seconds      | <3 seconds   | <3 seconds  | <55MB        |
| Edge    | <3 seconds      | <2 seconds   | <2 seconds  | <50MB        |

## 7. Network chaos test suite

### Chaos engineering scenarios

```typescript
test("message delivery during network partition", async () => {
  const client1 = await createClient();
  const client2 = await createClient();
  const conversation = await client1.conversations.newConversation(
    client2.address,
  );
  await networkChaos.partitionNetwork(["client1"], ["client2"]);
  const messagePromise = conversation.send("Message during partition");
  setTimeout(() => networkChaos.restoreNetwork(), 10000);
  await expect(messagePromise).resolves.toBeTruthy();
});
```

Failure scenarios in suites/networkchaos.

## 8. Compatibility test suite

### Version matrix testing

```typescript
const versions = ["2.0.0", "2.1.0", "2.2.0"];
versions.forEach((v1) => {
  versions.forEach((v2) => {
    test(`${v1} to ${v2} compatibility`, async () => {
      const client1 = await createClientWithVersion(v1);
      const client2 = await createClientWithVersion(v2);
      await testCrossVersionMessaging(client1, client2);
    });
  });
});
```

Upgrade testing in suites/forks.

See [helpers](../helpers/README.md) for custom utilities and [Workflows](./workflows.md) for execution.
