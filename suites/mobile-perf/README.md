# Mobile Performance Test Suite

Measures application performance degradation ("slugishness") under increasing load conditions using different group sizes and worker counts to quantify performance at scale.

- Tests 3 configurations: small (10 workers, 250 participants), medium (30 workers, 450 participants), large (50 workers, 875 participants)
- Measures message delivery latency, group creation time, connection establishment, memory/CPU usage, and error rates
- Quantifies slugishness on 5-level scale: Optimal (0) → Minor (1) → Moderate (2) → Severe (3) → System Failure (4)
- Identifies performance breaking points and resource bottlenecks

```typescript
export const TEST_CONFIGS: Record<
  string,
  { size: number; count: number; messages: number }[]
> = {
  small: [
    { size: 2, count: 5, messages: 5 },
    { size: 10, count: 5, messages: 5 },
    { size: 50, count: 5, messages: 5 },
  ],
  medium: [
    { size: 2, count: 10, messages: 10 },
    { size: 10, count: 10, messages: 10 },
    { size: 50, count: 10, messages: 10 },
    { size: 100, count: 10, messages: 10 },
    { size: 150, count: 10, messages: 10 },
  ],
  large: [
    { size: 2, count: 15, messages: 15 },
    { size: 10, count: 15, messages: 15 },
    { size: 100, count: 15, messages: 15 },
    { size: 150, count: 15, messages: 15 },
    { size: 100, count: 15, messages: 15 },
    { size: 200, count: 15, messages: 15 },
  ],
};
```

## How to Run

```bash
# Run individual configurations
yarn test stress
```

## Mobile Performance Rating

| Configuration | Log in | Time to sync | On notif | Messages | Button Responses | Transitions | Scroll | Average | Est. Storage |
| ------------- | ------ | ------------ | -------- | -------- | ---------------- | ----------- | ------ | ------- | ------------ |
| **Small**     | 1      | 1            | 2        | 1        | 2                | 1           | 2      | 1       | ~2 MB        |
| **Medium**    | 1      | 3            | 3        | 3        | 3                | 3           | 3      | 3       | ~5 MB        |
| **Large**     | 1      | 3            | 3        | 3        | 3                | 3           | 4      | 3       | ~10 MB       |
| **Spam**      | 1      | 3            | 3        | 3        | 3                | 4           | 3      | 4       | ~5 MB        |
| **Dead**      | 1      | 3            | 3        | 4        | 3                | 4           | 3      | 3.3     | ~10 MB       |

### Configurations

**Small** ~15 groups, 15 messages  
**Medium** ~50 groups with 50 messages
**Large** ~90 groups with 15 messages
**Spam** ~200 dms with 1 messages  
**Dead** ~400 dms with 1 messages

### Performance Metrics

**App Launch Speed** - Time from app icon tap to conversation list display
**Login & Sync** - Time to authenticate and sync all conversations/messages from network
**Conversation Rendering** - Time to load and display conversation list in chronological order
**Message Display** - Time for individual messages to appear when opening a conversation
**Button Response** - How quickly UI buttons respond to user taps and interactions
**Notification Open** - Time to open app from push notification after being closed/backgrounded
**Transitions** - Speed of navigation between screens and UI state changes

### Rating Scale

**1** - **Instant** - All interactions feel immediate and responsive

**2** - **Fast** - Minor delays but still feels snappy

**3** - **Acceptable** - Noticeable delays but usable

**4** - **Slow** - Significant delays affecting user experience

**5** - **Unusable** - Severe delays causing user frustration
