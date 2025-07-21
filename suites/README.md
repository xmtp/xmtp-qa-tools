# XMTP test suite engineering report

## Test suite architecture

Our test suite is organized into 5 primary categories that validate XMTP protocol functionality, performance, and reliability across different scales and environments.

---

## 1. Browser Testing (`browser.test.ts`)

**Purpose**: Validates XMTP functionality in browser environments using Playwright automation.

### Test Coverage:

- `conversation stream with message`
- `conversation stream without message`
- `newDm and message stream`
- `newGroup and message stream`
- `conversation stream when creating the group`
- `conversation stream for new member`
- `new installation and message stream`

---

## 2. Functional + Regression Testing

**Purpose**: Core protocol validation including backward compatibility and edge case handling.

### Client Management (`clients.test.ts`)

- `validation and key package status`
- `inbox state from external inbox IDs`
- `downgrade last versions`
- `upgrade last versions`
- `shared identity and separate storage`

### Content Handling (`codec.test.ts`)

- `errors:  handle codec errors gracefully when sending unsupported content types`

### Debug Operations (`debug.test.ts`)

- `debug:  retrieve group debug information`
- `debug:  track epoch changes during group operations`
- `debug:  verify epoch consistency across members`
- `debug:  detect potential forks in group state`
- `debug:  verify debug info after metadata changes`
- `debug:  verify debug info structure completeness`

### Installation Management (`installations.test.ts`)

- `shared identity and separate storage`

### Metadata Operations (`metadata.test.ts`)

- `metadata:  update group name and verify persistence`
- `metadata:  update group description and verify persistence`
- `metadata:  update group image URL`
- `metadata:  verify metadata propagation to other members`
- `metadata:  handle empty and special characters in metadata`
- `metadata:  verify metadata state after group operations`

### Permission System (`permissions.test.ts`)

- `permissions:  add and remove admin permissions`
- `permissions:  add and remove super admin permissions`
- `permissions:  verify admin list management`
- `permissions:  admin can remove other members`
- `permissions:  super admin can manage other admins`

### Stream Validation (`streams.test.ts`)

- `membership:  verify member addition notifications`
- `consent:  verify consent state changes for direct messages`
- `consent:  verify consent state changes in groups`
- `messages:  verify direct message delivery`
- `messages:  verify group message delivery`
- `metadata:  verify group metadata updates`
- `conversations:  verify new conversation notifications`
- `members:  verify member addition to existing group`

### sync (`sync.test.ts`)

- `group sync performance: establish test environment by creating group with all participants`
- `group sync performance: send baseline message to group for sync performance testing`
- `group sync performance: measure performance impact of client-level conversations.sync() operation`
- `group sync performance: measure performance impact of individual conversation.sync() operation`
- `group sync performance: measure message retrieval performance without explicit sync`

---

## 3. Delivery, Order & Recovery Testing (`delivery.test.ts`)

**Purpose**: Validates message delivery reliability, ordering accuracy, and recovery mechanisms.

### Core Tests:

- `stream: verify message delivery and order accuracy using streams`
- `poll: verify message delivery and order accuracy using polling`
- `recovery: verify message recovery after stream interruption`

**Metrics Validated**:

- Reception percentage (successful message delivery)
- Order percentage (correct message sequencing)
- Recovery capability after network interruption

---

## 4. Performance Testing (`performance.test.ts`)

**Purpose**: Measures operation timing and throughput for standard group sizes (5-10 participants).

### Individual Operations:

- `create: measure creating a client`
- `canMessage: measure canMessage`
- `inboxState: measure inboxState`
- `newDm: measure creating a DM`
- `send: measure sending a gm`
- `stream: measure receiving a gm`
- `newDmByAddress: measure creating a DM`

### Scaled Operations (per group size):

- `newGroup-{i}: create a large group of {i} participants`
- `newGroupByAddress-{i}: create a large group of {i} participants`
- `groupsync-{i}: sync a large group of {i} participants`
- `updateName-{i}: update the group name`
- `send-{i}: measure sending a gm in a group of {i} participants`
- `stream-{i}: verify group message`
- `addMember-{i}: add members to a group`
- `removeMembers-{i}: remove a participant from a group`

---

## 5. Large Group Testing (`large.test.ts`)

**Purpose**: Validates scalability and performance at scale (10-50+ participants).

### Scalability Tests (per group size):

- `newGroup-{groupSize}: create a large group of {groupSize} participants`
- `groupsync-{groupSize}: sync a large group of {groupSize} participants`
- `addMember-{groupSize}: notify all members of additions in {groupSize} member group`
- `stream-{groupSize}: notify all members of message changes in {groupSize} member group`
- `updateName-{groupSize}: notify all members of metadata changes in {groupSize} member group`
- `sync-{groupSize}: perform cold start sync operations on {groupSize} member group`
- `syncAll-{groupSize}: perform cold start sync operations on {groupSize} member group`

**Key Measurements**:

- Stream notification latency across large participant counts
- sync performance with high member counts
- Cold start performance for new clients joining large groups
