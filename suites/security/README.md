# XMTP Security Testing Suite

Security tests for identifying XMTP protocol attack vectors. **Development environments only.**

## Attack Vectors

### 1. Infinite Welcome Messages Attack

**Description**: Flood targets with unlimited conversations causing denial of service.

**Technical Details**:

- No consent filtering on welcome messages
- Sequential processing during `syncAll()`
- 500 conversations/5min rate limit enables sustained attacks
- Database growth triggers mobile storage warnings

**Implementation**: `spam.test.ts` creates 1000 groups to demonstrate database bombing.

### 2. Involuntary Group Membership

**Description**: Add users to groups without consent; no self-removal mechanism exists.

**Technical Details**:

- Public KeyPackages enable arbitrary group creation
- Users remain cryptographic members indefinitely
- Group metadata changeable post-addition

**Attack Scenarios**:

- Create offensive groups with legitimate users
- Spoof legitimate groups, change metadata after joining
- Identity confusion with similar addresses

### 3. Malicious Agents

**Description**: Agents have full cryptographic access to all conversation messages.

**Attack Vectors**:

- **Surveillance**: Real-time message capture
- **Data Exfiltration**: Third-party storage
- **Spoofing**: Impersonate trusted participants
- **Log Leakage**: Accidental exposure in debugging

## Running Tests

```bash
# Environment setup (dev only)
export XMTP_ENV=dev
yarn gen:keys

# Run tests
yarn test suites/security/spam.test.ts
```

## Performance Indicators

| Metric       | Threshold        | Impact             |
| ------------ | ---------------- | ------------------ |
| Sync timeout | >30s             | DoS potential      |
| Memory spike | >100MB           | App crash risk     |
| DB growth    | >10MB/100 convos | Storage exhaustion |

## Test Files

- `spam.test.ts` - Welcome message flooding attack

## Mitigation Strategies

**Application Level**:

- Conversation limits per user
- Group membership consent mechanisms
- Database cleanup strategies
- Agent identification requirements

**Protocol Level**:

- Rate limiting for conversation creation
- Self-removal mechanisms for groups
- Consent states for welcome messages

---

**Responsible Testing**: Development environments only. Report vulnerabilities through proper channels.
