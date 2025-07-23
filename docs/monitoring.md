# Monitoring system s

Monitoring setup that tells us when things are working well and alerts us immediately when they're not.

## Automated workflows 1

| Test suite   | Performance | Resources                                                                                                                                                                             | Run frequency | Networks           |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ |
| Performance  |             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/metrics/performance.test.ts) | Every 30 min  | `dev` `production` |
| Delivery     |             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/metrics/delivery.test.ts)       | Every 30 min  | `dev` `production` |
| Functional   |             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Functional.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/functional)                   | Every 3 hours | `dev` `production` |
| Browser      |             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/functional/browser.test.ts)      | Every 30 min  | `dev` `production` |
| Groups       |             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Large.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/metrics/large.test.ts)             | Every 2 hours | `dev` `production` |
| NetworkChaos |             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/NetworkChaos.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/networkchaos)               | Daily         | `local`            |

Our test suite is organized into 6 primary categories that validate XMTP protocol functionality, performance, and reliability across different scales and environments.

---

## 1. Performance testing

Link to test code:
Link to test code [../suites/metrics/performance.test.ts](../suites/metrics/performance.test.ts)

**Purpose**: Measures operation timing and throughput for dms and small groups (5-10 members).

### Individual operations:

- `create: measure creating a client`
- `canMessage: measure canMessage`
- `inboxState: measure inboxState`
- `newDm: measure creating a DM`
- `send: measure sending a gm`
- `stream: measure receiving a gm`
- `newDmByAddress: measure creating a DM`

### Scaled operations (per group size):

- `newGroup-{i}: create a large group of {i} members`
- `newGroupByAddress-{i}: create a large group of {i} members`
- `groupsync-{i}: sync a large group of {i} members`
- `updateName-{i}: update the group name`
- `send-{i}: measure sending a gm in a group of {i} members`
- `stream-{i}: verify group message`
- `addMember-{i}: add members to a group`
- `removeMembers-{i}: remove a participant from a group`

**Measurements**:

- Operation performance in milliseconds

---

## 2. Delivery testing

Link to test code [../suites/metrics/delivery.test.ts](../suites/metrics/delivery.test.ts)

**Purpose**: Validates message delivery reliability, ordering accuracy, and recovery mechanisms.

### Core tests:

- `stream: verify message delivery and order accuracy using streams`
- `poll: verify message delivery and order accuracy using polling`
- `recovery: verify message recovery after stream interruption`

**Measurements**:

- Reception percentage (successful message delivery)
- Order percentage (correct message sequencing)
- Recovery capability after network interruption

---

## 3. Functional + regression testing

**Purpose**: Core protocol validation including regression testing.

### Client management

Link to test code [../suites/functional/clients.test.ts](../suites/functional/clients.test.ts)

- `validation and key package status`
- `inbox state from external inbox IDs`
- `downgrade last versions`
- `upgrade last versions`
- `shared identity and separate storage`

### Content handling

Link to test code [../suites/functional/codec.test.ts](../suites/functional/codec.test.ts)

- `errors:  handle codec errors gracefully when sending unsupported content types`

### Debug operations

Link to test code [../suites/functional/debug.test.ts](../suites/functional/debug.test.ts)

- `debug:  retrieve group debug information`
- `debug:  track epoch changes during group operations`
- `debug:  verify epoch consistency across members`
- `debug:  detect potential forks in group state`
- `debug:  verify debug info after metadata changes`
- `debug:  verify debug info structure completeness`

### Installation management

Link to test code [../suites/functional/installations.test.ts](../suites/functional/installations.test.ts)

- `shared identity and separate storage`

### Metadata operations

Link to test code [../suites/functional/metadata.test.ts](../suites/functional/metadata.test.ts)

- `metadata:  update group name and verify persistence`
- `metadata:  update group description and verify persistence`
- `metadata:  update group image URL`
- `metadata:  verify metadata propagation to other members`
- `metadata:  handle empty and special characters in metadata`
- `metadata:  verify metadata state after group operations`

### Permission system

Link to test code [../suites/functional/permissions.test.ts](../suites/functional/permissions.test.ts)

- `permissions:  add and remove admin permissions`
- `permissions:  add and remove super admin permissions`
- `permissions:  verify admin list management`
- `permissions:  admin can remove other members`
- `permissions:  super admin can manage other admins`

### Stream validation

Link to test code [../suites/functional/streams.test.ts](../suites/functional/streams.test.ts)

- `membership:  verify member addition notifications`
- `consent:  verify consent state changes for direct messages`
- `consent:  verify consent state changes in groups`
- `messages:  verify direct message delivery`
- `messages:  verify group message delivery`
- `metadata:  verify group metadata updates`
- `conversations:  verify new conversation notifications`
- `members:  verify member addition to existing group`

### Sync

Link to test code [../suites/functional/sync.test.ts](../suites/functional/sync.test.ts)

- `group sync performance: establish test environment by creating group with all members`
- `group sync performance: send baseline message to group for sync performance testing`
- `group sync performance: measure performance impact of client-level conversations.sync() operation`
- `group sync performance: measure performance impact of individual conversation.sync() operation`
- `group sync performance: measure message retrieval performance without explicit sync`

---

## 4. Browser testing

Link to test code [../suites/functional/browser.test.ts](../suites/functional/browser.test.ts)

**Purpose**: Validates XMTP functionality in the browser SDK using Playwright automation.

### Test coverage:

- `conversation stream with message`
- `conversation stream without message`
- `newDm and message stream`
- `newGroup and message stream`
- `conversation stream when creating the group`
- `conversation stream for new member`
- `new installation and message stream`

---

## 5. Large group testing (`large.test.ts`)

**Purpose**: Validates scalability and performance at scale (50-250 members).

### Scalability tests (per group size):

- `newGroup-{groupSize}: create a large group of {groupSize} members`
- `groupsync-{groupSize}: sync a large group of {groupSize} members`
- `addMember-{groupSize}: notify all members of additions in {groupSize} member group`
- `stream-{groupSize}: notify all members of message changes in {groupSize} member group`
- `updateName-{groupSize}: notify all members of metadata changes in {groupSize} member group`
- `sync-{groupSize}: perform cold start sync operations on {groupSize} member group`
- `syncAll-{groupSize}: perform cold start sync operations on {groupSize} member group`

**Measurements**:

- Operation performance per group size

## 6. Network chaos test suite

Link to test code [../suites/networkchaos](../suites/networkchaos)

**Purpose**: Validates XMTP protocol resilience under adverse network conditions using local 4-node XMTP-go cluster with simulated network partitions, delays, and failures.

### Core resilience tests:

- `smoketests: basic connectivity and functionality validation`
- `dm-duplicate-prevention: verify duplicate message prevention in unreliable networks`
- `group-partition-delayedreceive: test message delivery after network partition recovery`
- `node-blackhole: validate behavior when nodes become unreachable`
- `networkchaos: comprehensive network disruption scenarios`
- `group-reconciliation: verify group state consistency after network issues`
- `group-client-partition: test client behavior during network partitions`
- `keyrotation: validate key rotation under network stress`

**Environment**: Local 4-node cluster with simulated network conditions

**Measurements**:

- Message delivery resilience
- Group state consistency
- Recovery time after network disruption
- Duplicate prevention effectiveness
