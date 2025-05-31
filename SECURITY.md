# XMTP Security & Spam Protection

This document provides a comprehensive overview of XMTP's security landscape, spam protection mechanisms, and current vulnerabilities. With TBA and Convos as our primary mobile applications, understanding and mitigating security risks is critical for user safety and protocol adoption.

## Core Security Problems

The XMTP protocol faces two fundamental security challenges that require different solution approaches:

### 1. Involuntary Group Membership

**Problem**: Users appear to other members as full participants in groups before taking any explicit action to join.

**Impact**:

- Users can be added to groups without consent
- Reputation damage from association with unwanted groups
- Privacy violations through forced group membership

### 2. Silent Client Actions

**Problem**: User clients automatically sync, stream, and process group data before explicit user consent.

**Impact**:

- Bandwidth consumption from unwanted groups
- Storage of unwanted encrypted content
- Processing overhead from spam groups

## Current Protection Mechanisms

### UI-Level Protection ✅ Implemented

| Protection Method    | Description                              | Effectiveness | Apps Using  |
| -------------------- | ---------------------------------------- | ------------- | ----------- |
| Request Tab          | Separate inbox for unknown contacts      | 🟢 High       | TBA, Convos |
| Message Hiding       | Hide messages from blocked/unknown users | 🟢 High       | TBA, Convos |
| Consent Filtering    | Filter conversations by consent state    | 🟢 High       | All Apps    |
| Group Member Display | Show who added user to group             | 🟡 Medium     | TBA, Convos |

### Protocol-Level Protection ✅ Implemented

| Protection Method       | Description                            | Effectiveness | Implementation           |
| ----------------------- | -------------------------------------- | ------------- | ------------------------ |
| Consent State Filtering | Only sync `allowed` conversations      | 🟢 High       | `conversations.list()`   |
| Strategic Sync          | Selective conversation synchronization | 🟡 Medium     | `syncAll()` with filters |
| Content Type Filtering  | Filter non-text message types          | 🟡 Medium     | Message processing       |

#### Best Practices for Apps

```typescript
// Only sync conversations with explicit consent
await client.conversations.sync({
  consentState: ConsentState.Allowed,
});

// Filter conversations by consent state
const allowedConversations = await client.conversations.list({
  consentState: ConsentState.Allowed,
});

// Strategic message streaming
const stream = await client.conversations.streamAllMessages();
for await (const message of stream) {
  // Filter out unwanted content
  if (message.contentType?.typeId !== "text") continue;
  if (message.senderInboxId === client.inboxId) continue;

  // Check consent before processing
  const conversation = await client.conversations.getConversationById(
    message.conversationId,
  );
  if (conversation.consentState !== ConsentState.Allowed) continue;

  // Process allowed message
  processMessage(message);
}
```

## Critical Security Gaps 🔴

### 1. Infinite Welcome Messages Attack

**Severity**: 🔴 Critical  
**Status**: ⚠️ Unprotected  
**Impact**: App becomes unusable

**Description**: Malicious users can add targets to unlimited conversations, flooding them with welcome messages.

**Technical Details**:

- Welcome messages have no consent state filtering
- `syncAll()` processes welcome messages sequentially
- Rate limits allow 500 new conversations every 5 minutes
- Sync timeouts prevent access to legitimate conversations

**Current Workarounds**: None effective

### 2. Involuntary Group Membership

**Severity**: 🔴 Critical  
**Status**: ⚠️ Unprotected  
**Impact**: Privacy violation, reputation damage

**Description**: Users are cryptographically added to groups without consent and cannot remove themselves.

**Technical Details**:

- KeyPackages are public information
- Anyone can create groups with anyone
- No self-removal mechanism exists
- Users remain verifiable group members indefinitely

**Current Workarounds**:

- UI-level hiding (doesn't solve underlying membership)
- Consent filtering (doesn't prevent group creation)

### 3. Malicious Agents in Conversations

**Severity**: 🟡 High  
**Status**: ⚠️ Unprotected  
**Impact**: Complete message access, privacy violation

**Description**: Agents have full cryptographic access to all messages in conversations they join.

**Potential Attacks**:

- **Surveillance**: Capture and analyze all messages
- **Data Exfiltration**: Store messages on third-party servers
- **Spoofing**: Impersonate trusted participants
- **Silent Monitoring**: Monitor without clear identification
- **Log Leakage**: Accidentally expose messages in debug logs

**Current Protections**: None at protocol level

### 4. Group Invite Spoofing

**Severity**: 🟡 High  
**Status**: ⚠️ Unprotected  
**Impact**: Users join malicious groups unknowingly

**Description**: Group invite links can be spoofed or changed after sharing.

**Attack Vectors**:

- Snapshot group state at invite time, modify after
- Generic invite links without group preview
- No verification of group contents before joining

### 5. History Transfer Vulnerabilities

**Severity**: 🟡 High  
**Status**: ⚠️ Unprotected  
**Impact**: Complete message history exposure

**Description**: Signing new installations automatically transfers message history.

**Risk Scenarios**:

- User unknowingly signs malicious installation
- Compromised device gains access to full history
- No granular control over history sharing

### 6. Message Editing & Deletion Gaps

**Severity**: 🟡 Medium  
**Status**: ⚠️ Unprotected  
**Impact**: Persistent harmful content

**Description**: No mechanism for message moderation or self-deletion.

**Missing Features**:

- Message editing by sender
- Message deletion by sender
- Moderator message removal
- Content moderation tools
