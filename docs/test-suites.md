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

### What it does

Makes sure the core XMTP protocol actually works - DMs, group chats, streaming, sync, consent, all the stuff users expect to just work.

### What we cover

#### Core protocol features

- **Direct messages**: 1:1 conversation creation and messaging
- **Group conversations**: Multi-member group creation, messaging, and management
- **Message streaming**: Real-time message delivery and stream handling
- **Conversation sync**: State synchronization across multiple clients
- **Consent framework**: Privacy and consent preference management
- **Content codecs**: Support for different message content types

#### Cross-platform compatibility

````typescript
// Example test structure
describe('Cross-platform messaging', () => {
  test('Browser SDK to Node SDK message delivery', async () => {
    const browserClient = await createBrowserClient();
    const nodeClient = await createNodeClient();

    const conversation = await browserClient.conversations.newConversation(
      nodeClient.address
    );

    await conversation.send('Hello from browser');

    // Verify delivery on Node SDK
    const messages = await nodeClient.conversations
      .getConversation(browserClient.address)
      .messages();

    expect(messages).toContainMessage('Hello from browser');
  });

  test('React Native to Swift message delivery', async () => {
    const rnClient = await createReactNativeClient();
    const swiftClient = await createSwiftClient();

    const conversation = await rnClient.conversations.newConversation(
      swiftClient.address
    );

    await conversation.send('Hello from React Native');

    // Verify delivery on Swift client
    const messages = await swiftClient.inbox.messages(conversation.id);
    expect(messages.last().text).toBe('Hello from React Native');
  });
});

#### Backward compatibility
- **SDK Version Testing**: Validates compatibility across last 3 SDK versions (0.0.47 → 2.2.0+)
- **Protocol Upgrades**: Tests seamless protocol version transitions
- **Client Downgrades**: Ensures older clients can still communicate

### Automation details
- **Framework**: Vitest with custom XMTP helpers
- **Execution**: GitHub Actions with matrix strategy for multiple environments
- **Artifacts**: Test reports, performance metrics, failure screenshots
- **Notifications**: Slack alerts on failures

## 2. Performance test suite

### Purpose
Benchmarks XMTP SDK operations, measures latency, and validates performance under various conditions.

### Key metrics

#### SDK operation timing
```typescript
test('Client creation performance', async () => {
  const startTime = performance.now();

  const client = await Client.create(wallet, { env: 'dev' });

  const duration = performance.now() - startTime;

  // Submit metric to Datadog
  await submitMetric('xmtp.sdk.client_creation_time', duration, {
    env: 'dev',
    sdk_version: client.version
  });

  expect(duration).toBeLessThan(5000); // 5 second SLO
});

test('Group message send performance', async () => {
  const group = await createGroup(50);
  const start = performance.now();

  await group.send('Benchmark message');

  const duration = performance.now() - start;
  await submitMetric('xmtp.group.send_time', duration, {
    group_size: 50
  });

  expect(duration).toBeLessThan(2000);
});
````

#### Throughput Testing

- **Message Rate**: Messages per second under sustained load
- **Concurrent Clients**: Performance with multiple simultaneous clients
- **Large Payloads**: Handling of maximum message sizes

#### Latency Measurements

- **End-to-End Latency**: Message send to delivery time
- **Cross-Region Latency**: Performance across geographic regions
- **Protocol Overhead**: XMTP-specific processing time

### Performance targets

| Metric                | Target      | Alert Threshold |
| --------------------- | ----------- | --------------- |
| Client Creation       | <5 seconds  | >10 seconds     |
| Message Send          | <2 seconds  | >5 seconds      |
| Message Delivery      | <3 seconds  | >10 seconds     |
| Group Creation        | <10 seconds | >20 seconds     |
| Stream Initialization | <5 seconds  | >10 seconds     |

## 3. Delivery test suite

### Purpose

Ensures reliable message delivery across different environments, networks, and SDK combinations.

### Test scenarios

#### Cross-environment delivery

```typescript
describe("Cross-environment delivery", () => {
  test("dev to production message delivery", async () => {
    const devClient = await createClient({ env: "dev" });
    const prodClient = await createClient({ env: "production" });

    const conversation = await devClient.conversations.newConversation(
      prodClient.address,
    );

    const messageId = await conversation.send("Cross-env test message");

    // Wait for delivery and verify on production
    await waitForDelivery(prodClient, messageId, { timeout: 30000 });
  });
});
```

#### Multi-region testing

- **US East to EU West**: Transatlantic message delivery
- **Asia Pacific Coverage**: Australia, Japan, Singapore regions
- **South America**: Brazil, Argentina testing

#### Delivery rate tracking

- **Success Rate**: Percentage of messages successfully delivered
- **Order Preservation**: Messages delivered in correct sequence
- **Duplicate Detection**: No message duplication or loss

### Reliability targets

| Environment Pair         | Target Delivery Rate | Max Latency |
| ------------------------ | -------------------- | ----------- |
| dev ↔ dev               | 99.9%                | 2 seconds   |
| production ↔ production | 99.95%               | 3 seconds   |
| dev ↔ production        | 99.5%                | 5 seconds   |
| Cross-region             | 99.0%                | 10 seconds  |

## 4. Groups (large-scale) test suite

### Purpose

Validates XMTP group functionality at scale, testing performance and reliability with large member counts.

### Scale testing

#### Member count scaling

```typescript
describe("Large group scaling", () => {
  test("400 member group performance", async () => {
    const admin = await createClient();
    const members = await createMultipleClients(399);

    const group = await admin.conversations.newGroup(
      members.map((m) => m.address),
    );

    // Measure group creation time
    const createTime = await measureOperation(async () => {
      await group.sync();
    });

    expect(createTime).toBeLessThan(60000); // 1 minute SLO

    // Test message delivery to all members
    await group.send("Message to 400 members");

    // Verify delivery across all members
    const deliveryResults = await Promise.allSettled(
      members.map((member) =>
        waitForGroupMessage(member, group.id, "Message to 400 members"),
      ),
    );

    const successRate =
      deliveryResults.filter((r) => r.status === "fulfilled").length /
      members.length;
    expect(successRate).toBeGreaterThan(0.95); // 95% delivery rate
  });
});
```

#### Group operations at scale

- **Member Addition**: Adding members to existing large groups
- **Member Removal**: Removing members and testing access revocation
- **Admin Operations**: Permission changes in large groups
- **Message Broadcasting**: Delivery to all members simultaneously

### Performance characteristics

| Group Size  | Creation Time | Message Delivery | Success Rate |
| ----------- | ------------- | ---------------- | ------------ |
| 10 members  | <5 seconds    | <5 seconds       | 99.9%        |
| 50 members  | <15 seconds   | <10 seconds      | 99.5%        |
| 100 members | <30 seconds   | <20 seconds      | 99.0%        |
| 400 members | <60 seconds   | <45 seconds      | 95.0%        |

## 5. Agents test suite

### Purpose

Monitors health and responsiveness of XMTP bots and automation agents deployed across the network.

### Agent monitoring

#### Bot health checks

```typescript
describe("Agent health monitoring", () => {
  test("GM bot responsiveness", async () => {
    const testClient = await createClient();

    // Send message to GM bot
    const conversation = await testClient.conversations.newConversation(
      "0x937C0d4a6294cdfa575de17382c7076b579DC176", // hi.xmtp.eth
    );

    const messageTime = Date.now();
    await conversation.send("health check");

    // Wait for bot response
    const response = await waitForResponse(conversation, {
      timeout: 10000,
      expectedContent: "hi",
    });

    const responseTime = Date.now() - messageTime;

    // Submit response time metric
    await submitMetric("xmtp.agent.response_time", responseTime, {
      agent: "gm-bot",
      env: process.env.XMTP_ENV,
    });

    expect(responseTime).toBeLessThan(5000); // 5 second SLO
  });
});
```

#### Monitored agents

| Agent             | ENS Address | Purpose                  | SLO Target   |
| ----------------- | ----------- | ------------------------ | ------------ |
| **hi.xmtp.eth**   | `0x937C...` | Simple greeting bot      | <2s response |
| **key-check.eth** | `0x235C...` | Key package verification | <5s response |
| **stress-test**   | Multiple    | Load testing automation  | 99% uptime   |

#### Agent deployment health

- **Railway Service Status**: Monitoring deployed agent containers
- **Resource Utilization**: Memory and CPU usage tracking
- **Error Rate Monitoring**: Failed message handling
- **Uptime Tracking**: Service availability metrics

## 6. Browser test suite

### Purpose

Validates XMTP functionality in browser environments using Playwright automation, specifically testing the WASM binding performance.

### Browser automation

#### Playwright integration

```typescript
test("Browser SDK conversation flow", async ({ page }) => {
  // Navigate to test application
  await page.goto("https://xmtp.chat");

  // Connect wallet
  await page.click('[data-testid="connect-wallet"]');
  await connectMetaMask(page);

  // Initialize XMTP
  await page.click('[data-testid="connect-xmtp"]');
  await signXMTPMessages(page);

  // Create conversation
  await page.fill('[data-testid="new-conversation-input"]', testAddress);
  await page.click('[data-testid="start-conversation"]');

  // Send message
  await page.fill('[data-testid="message-input"]', "Browser test message");
  await page.click('[data-testid="send-message"]');

  // Verify message appears
  await expect(page.locator('[data-testid="message"]')).toContainText(
    "Browser test message",
  );
});
```

#### WASM performance testing

- **Bundle Loading**: WASM module load times
- **Memory Usage**: Browser memory consumption patterns
- **Client Creation**: Browser-specific initialization performance
- **Stream Handling**: Real-time message streaming in browser

#### Cross-browser compatibility

- **Chrome**: Latest stable version
- **Firefox**: Latest stable version
- **Safari**: Latest stable version (macOS CI)
- **Edge**: Latest stable version

### Browser-specific metrics

| Browser | Client Creation | Message Send | Stream Init | Memory Usage |
| ------- | --------------- | ------------ | ----------- | ------------ |
| Chrome  | <3 seconds      | <2 seconds   | <2 seconds  | <50MB        |
| Firefox | <4 seconds      | <2 seconds   | <3 seconds  | <60MB        |
| Safari  | <4 seconds      | <3 seconds   | <3 seconds  | <55MB        |
| Edge    | <3 seconds      | <2 seconds   | <2 seconds  | <50MB        |

## 7. Network chaos test suite

### Purpose

Tests XMTP protocol resilience under adverse network conditions and infrastructure failures.

### Chaos engineering scenarios

#### Network partitions

```typescript
describe("Network resilience", () => {
  test("message delivery during network partition", async () => {
    const client1 = await createClient();
    const client2 = await createClient();

    const conversation = await client1.conversations.newConversation(
      client2.address,
    );

    // Simulate network partition
    await networkChaos.partitionNetwork(["client1"], ["client2"]);

    // Attempt to send message during partition
    const messagePromise = conversation.send("Message during partition");

    // Restore network after 10 seconds
    setTimeout(() => networkChaos.restoreNetwork(), 10000);

    // Verify message is delivered after restoration
    await expect(messagePromise).resolves.toBeTruthy();
  });
});
```

#### Failure scenarios

- **Node Disconnections**: Handling XMTP node outages
- **Latency Injection**: Performance under high-latency conditions
- **Packet Loss**: Resilience to network packet loss
- **Bandwidth Limitations**: Behavior under low-bandwidth conditions

## 8. Compatibility test suite

### Purpose

Ensures compatibility across different XMTP SDK versions and validates upgrade/downgrade scenarios.

### Version matrix testing

#### SDK version compatibility

```typescript
describe("SDK version compatibility", () => {
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
});
```

#### Upgrade/downgrade testing

- **Client Upgrades**: Seamless SDK version upgrades
- **Protocol Compatibility**: Backward compatibility maintenance
- **Data Migration**: Conversation history preservation
- **Feature Parity**: Core functionality across versions

## Test infrastructure

### Execution environment

#### GitHub Actions matrix

```yaml
strategy:
  matrix:
    env: [dev, production]
    node-version: [20.x, 22.x]
    os: [ubuntu-latest, macos-latest, windows-latest]
```

#### Custom test helpers

The test suites leverage custom helper utilities:

- **Client management** ([helpers/client.ts](../helpers/client.ts)): Streamlined client creation and management
- **Stream utilities** ([helpers/streams.ts](../helpers/streams.ts)): Message streaming and synchronization helpers
- **Metrics collection** ([helpers/datadog.ts](../helpers/datadog.ts)): Automated performance metric submission
- **Logging** ([helpers/logger.ts](../helpers/logger.ts)): Structured test execution logging

### Performance monitoring

Each test suite automatically submits metrics to Datadog:

```typescript
// Automatic metric submission
await submitMetric("xmtp.test.execution_time", testDuration, {
  suite: "functional",
  test_name: "cross_platform_messaging",
  env: process.env.XMTP_ENV,
  success: testResult.success,
});
```

### Failure handling

#### Retry mechanisms

- **Flaky Test Detection**: Automatic retry for intermittent failures
- **Network Timeout Handling**: Configurable timeout values
- **Resource Cleanup**: Automatic client and resource cleanup

#### Debugging support

- **Debug Mode**: Enhanced logging with `--debug` flag
- **Artifact Collection**: Screenshots, logs, and network traces
- **Local Reproduction**: Tools for running tests locally
