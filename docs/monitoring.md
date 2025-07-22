# Monitoring system

We've built a monitoring setup that tells us when things are working well and alerts us immediately when they're not.

## Automated workflows

| Test suite  | Performance | Resources                                                                                                                                                                             | Run frequency | Networks           |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ |
| Performance |             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/metrics/performance.test.ts) | Every 30 min  | `dev` `production` |
| Delivery    |             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/metrics/delivery.test.ts)       | Every 30 min  | `dev` `production` |
| Functional  |             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Functional.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/functional)                   | Every 3 hours | `dev` `production` |
| Browser     |             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/functional/browser.test.ts)      | Every 30 min  | `dev` `production` |
| Groups      |             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Large.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/metrics/large.test.ts)             | Every 2 hours | `dev` `production` |

Our test suite is organized into 5 primary categories that validate XMTP protocol functionality, performance, and reliability across different scales and environments.

---

## 1. Performance testing [../suites/metrics/performance.test.ts](../suites/metrics/performance.test.ts)

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

## 2. Delivery testing [../suites/metrics/delivery.test.ts](../suites/metrics/delivery.test.ts)

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

### Client management [../suites/functional/clients.test.ts](../suites/functional/clients.test.ts)

- `validation and key package status`
- `inbox state from external inbox IDs`
- `downgrade last versions`
- `upgrade last versions`
- `shared identity and separate storage`

### Content handling [../suites/functional/codec.test.ts](../suites/functional/codec.test.ts)

- `errors:  handle codec errors gracefully when sending unsupported content types`

### Debug operations [../suites/functional/debug.test.ts](../suites/functional/debug.test.ts)

- `debug:  retrieve group debug information`
- `debug:  track epoch changes during group operations`
- `debug:  verify epoch consistency across members`
- `debug:  detect potential forks in group state`
- `debug:  verify debug info after metadata changes`
- `debug:  verify debug info structure completeness`

### Installation management [../suites/functional/installations.test.ts](../suites/functional/installations.test.ts)

- `shared identity and separate storage`

### Metadata operations [../suites/functional/metadata.test.ts](../suites/functional/metadata.test.ts)

- `metadata:  update group name and verify persistence`
- `metadata:  update group description and verify persistence`
- `metadata:  update group image URL`
- `metadata:  verify metadata propagation to other members`
- `metadata:  handle empty and special characters in metadata`
- `metadata:  verify metadata state after group operations`

### Permission system [../suites/functional/permissions.test.ts](../suites/functional/permissions.test.ts)

- `permissions:  add and remove admin permissions`
- `permissions:  add and remove super admin permissions`
- `permissions:  verify admin list management`
- `permissions:  admin can remove other members`
- `permissions:  super admin can manage other admins`

### Stream validation [../suites/functional/streams.test.ts](../suites/functional/streams.test.ts)

- `membership:  verify member addition notifications`
- `consent:  verify consent state changes for direct messages`
- `consent:  verify consent state changes in groups`
- `messages:  verify direct message delivery`
- `messages:  verify group message delivery`
- `metadata:  verify group metadata updates`
- `conversations:  verify new conversation notifications`
- `members:  verify member addition to existing group`

### Sync [../suites/functional/sync.test.ts](../suites/functional/sync.test.ts)

- `group sync performance: establish test environment by creating group with all members`
- `group sync performance: send baseline message to group for sync performance testing`
- `group sync performance: measure performance impact of client-level conversations.sync() operation`
- `group sync performance: measure performance impact of individual conversation.sync() operation`
- `group sync performance: measure message retrieval performance without explicit sync`

---

## 4. Browser testing [../suites/functional/browser.test.ts](../suites/functional/browser.test.ts)

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
