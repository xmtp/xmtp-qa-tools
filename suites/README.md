# Monitoring system

Monitoring setup that tells us when things are working well and alerts us immediately when they're not.

## Automated workflows

| Test suite  | Status                                                                                                                                                                       | Resources                                                                                                                                                                        | Run frequency | Networks           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ |
| Regression  | [![Regression](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Regression.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Regression.yml)    | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Regression.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/functional)              | Every 2 hours | `dev` `production` |
| Performance | [![Performance](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml) | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Performance.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/performance.test.ts)    | Every 30 min  | `dev` `production` |
| Delivery    | [![Dev Delivery](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml)      | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Delivery.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/delivery.test.ts)          | Every 30 min  | `dev` `production` |
| Agents      | [![Agents](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml)                | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/agents)                      | Every 5 min   | `dev` `production` |
| Browser     | [![Browser](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml)             | [Workflow](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml) / [Test code](https://github.com/xmtp/xmtp-qa-tools/tree/main/suites/functional/browser.test.ts) | Every 30 min  | `dev` `production` |

Our test suite is organized into 6 primary categories that validate XMTP protocol functionality, performance, and reliability across different scales and environments.

## 1. Performance

Link to test code [../suites/performance.test.ts](../suites/performance.test.ts)

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
- `stream-{i}: group message`
- `addMember-{i}: add members to a group`
- `removeMembers-{i}: remove a participant from a group`

**Measurements**:

- Operation performance in milliseconds

## 2. Delivery

Link to test code [../suites/delivery.test.ts](../suites/delivery.test.ts)

**Purpose**: Validates message delivery reliability, ordering accuracy, and recovery mechanisms.

### Core tests:

- `stream: message delivery and order accuracy using streams`
- `poll: message delivery and order accuracy using polling`
- `recovery: message recovery after stream interruption`

**Measurements**:

- Reception percentage (successful message delivery)
- Order percentage (correct message sequencing)
- Recovery capability after network interruption

## 3. Regression

**Purpose**: Core protocol validation including regression with 3 last versions of the SDK and bindings.

### Client management

Link to test code [../suites/functional/clients.test.ts](../suites/functional/clients.test.ts)

- `downgrade last versions`
- `validation and key package status`
- `inbox state`
- `installations`
- `upgrade last versions`

### Content handling

Link to test code [../suites/functional/codec.test.ts](../suites/functional/codec.test.ts)

- `errors:  handle codec errors gracefully when sending unsupported content types`

### Debug operations

Link to test code [../suites/functional/debug.test.ts](../suites/functional/debug.test.ts)

- `retrieve group debug information`
- `track epoch changes during group operations`
- `epoch consistency across members`
- `detect potential forks in group state`
- `debug info after metadata changes`
- `debug info structure completeness`

### Metadata operations

Link to test code [../suites/functional/metadata.test.ts](../suites/functional/metadata.test.ts)

- `update group name and persistence`
- `update group description and persistence`
- `update group image URL`
- `metadata propagation to other members`
- `handle empty and special characters in metadata`
- `metadata state after group operations`

### Permission system

Link to test code [../suites/functional/permissions.test.ts](../suites/functional/permissions.test.ts)

- `add and remove admin permissions`
- `add and remove super admin permissions`
- `admin list management`
- `admin can remove other members`
- `super admin can manage other admins`

### Streams

Link to test code [../suites/functional/streams.test.ts](../suites/functional/streams.test.ts)

- `member addition notifications`
- `consent state changes for direct messages`
- `consent state changes in groups`
- `direct message delivery`
- `group message delivery`
- `group metadata updates`
- `new conversation notifications`
- `member addition to existing group`

### Sync

Link to test code [../suites/functional/sync.test.ts](../suites/functional/sync.test.ts)

- `sync: client.conversations.sync()`
- `group sync: individual conversation.sync()`
- `syncall: client.conversations.sync()`

## 4. Browser

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

## 5. Large groups

**Purpose**: Validates scalability and performance at scale (50-250 members).

### Scalability tests (per group size):

- `newGroup-{groupSize}: create a large group of {groupSize} members`
- `groupsync-{groupSize}: sync a large group of {groupSize} members`
- `addMember-{groupSize}:  stream members of additions in {groupSize} member group`
- `stream-{groupSize}:  stream members of message changes in {groupSize} member group`
- `updateName-{groupSize}:  stream members of metadata changes in {groupSize} member group`
- `sync-{groupSize}: perform cold start sync operations on {groupSize} member group`
- `syncAll-{groupSize}: perform cold start sync operations on {groupSize} member group`

**Measurements**:

- Operation performance per group size

## 6. Network chaos test suite

Link to test code [../suites/networkchaos](../suites/networkchaos)

**Purpose**: Validates XMTP protocol resilience under adverse network conditions using local 4-node XMTP-go cluster with simulated network partitions, delays, and failures.

### Core resilience tests:

- `smoketests: basic connectivity and functionality validation`
- `dm-duplicate-prevention: duplicate message prevention in unreliable networks`
- `group-partition-delayedreceive: test message delivery after network partition recovery`
- `node-blackhole: validate behavior when nodes become unreachable`
- `networkchaos: comprehensive network disruption scenarios`
- `group-reconciliation: group state consistency after network issues`
- `group-client-partition: test client behavior during network partitions`
- `keyrotation: validate key rotation under network send`

**Environment**: Local 4-node cluster with simulated network conditions

**Measurements**:

- Message delivery resilience
- Group state consistency
- Recovery time after network disruption
- Duplicate prevention effectiveness
