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
  xl: [
    { size: 2, count: 100, messages: 20 },
    { size: 10, count: 100, messages: 20 },
  ],
};
```

## How to Run

```bash
# Run individual configurations
yarn test stress
```

## Mobile Performance Rating v82

| Configuration | Log in | On notif | Messages | Button Responses | Transitions | Scroll          | Rating          |
| ------------- | ------ | -------- | -------- | ---------------- | ----------- | --------------- | --------------- |
| **Small**     | 4      | 4        | 3        | 2                | 1           | 2               | ⭐️⭐️⭐️⭐️⭐️ |
| **Medium**    | 1      | 1        | 1        | 2                | 3           | 3               | ⭐️⭐️⭐️⭐️⭐️ |
| **Large**     | 2      | 1        | 1        | 3                | 4           | ⭐️⭐️⭐️⭐️⭐️ |
| **Spam**      | 1      | 1        | 1        | 3                | 4           | 3               | ⭐️⭐️⭐️⭐️⭐️ |
| **Dead**      | 1      | 1        | 1        | 4                | 3           | ⭐️⭐️⭐️⭐️⭐️ |

## Mobile Performance Rating v83

| Configuration | Log in | On notif | Messages | Button Responses | Transitions | Scroll          | Rating          |
| ------------- | ------ | -------- | -------- | ---------------- | ----------- | --------------- | --------------- |
| **Small**     | 4      | 4        | 3        | 2                | 1           | 2               | ⭐️⭐️⭐️⭐️⭐️ |
| **Medium**    | 2      | 3        | 3        | 3                | 3           | 3               | ⭐️⭐️⭐️⭐️⭐️ |
| **Large**     | 2      | 1        | 1        | 3                | 4           | ⭐️⭐️⭐️⭐️⭐️ |
| **Spam**      | 1      | 1        | 1        | 3                | 4           | 3               | ⭐️⭐️⭐️⭐️⭐️ |
| **Dead**      | 1      | 1        | 1        | 4                | 3           | ⭐️⭐️⭐️⭐️⭐️ |

### Configurations

**Small** ~15 groups, 15 messages ~ 2 MB
**Medium** ~50 groups with 50 messages ~ 5 MB
**Large** ~90 groups with 15 messages ~ 10 MB
**XL** ~200 groups with 20 messages ~ 5 MB

### Performance Metrics

**Log in** - Time from app icon tap to conversation list display
**Time to sync** - Time to authenticate and sync all conversations/messages from network
**On notif** - Time for individual messages to appear when opening a conversation
**Messages** - How quickly UI buttons respond to user taps and interactions
**Button Responses** - Time to open app from push notification after being closed/backgrounded
**Transitions** - Speed of navigation between screens and UI state changes
**Scroll** - How quickly UI scrolls to the bottom of the conversation
**Average** - Average of all metrics

### Rating Scale

⭐️⭐️⭐️⭐️⭐️ - **Instant** - All interactions feel immediate and responsive

⭐️⭐️⭐️⭐️ - **Fast** - Minor delays but still feels snappy

⭐️⭐️⭐️ - **Acceptable** - Noticeable delays but usable

⭐️⭐️ - **Slow** - Significant delays affecting user experience

⭐️ - **Unusable** - Severe delays causing user frustration
