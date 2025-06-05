# Mobile Performance Test Suite

Measures application performance degradation ("slugishness") under increasing load conditions using different group sizes and worker counts to quantify performance at scale.

- Tests 3 configurations: small (10 workers, 250 participants), medium (30 workers, 450 participants), large (50 workers, 875 participants)
- Measures message delivery latency, group creation time, connection establishment, memory/CPU usage, and error rates
- Quantifies slugishness on 5-level scale: Optimal (0) → Minor (1) → Moderate (2) → Severe (3) → System Failure (4)
- Identifies performance breaking points and resource bottlenecks

```typescript
// Predefined test configurations
export const TEST_CONFIGS: Record<string, StressTestConfig> = {
  small: {
    largeGroups: [50],
    workerCount: 10,
    messageCount: 5,
    groupCount: 5,
    sizeLabel: "small",
  },
  medium: {
    largeGroups: [50, 100],
    workerCount: 30,
    messageCount: 10,
    groupCount: 3,
    sizeLabel: "medium",
  },
  large: {
    largeGroups: [50, 100, 200],
    workerCount: 50,
    messageCount: 15,
    groupCount: 5,
    sizeLabel: "large",
  },
};
```

## How to Run

```bash
# Run individual configurations
yarn test stress
```

## Mobile Performance Rating

| Configuration | Total Load                      | Workers | Stars      | App Launch | Conversation Rendering | Message Display | Transitions | Est. Storage |
| ------------- | ------------------------------- | ------- | ---------- | ---------- | ---------------------- | --------------- | ----------- | ------------ |
| **Small**     | ~250 participants, 50 messages  | 10      | ⭐⭐⭐⭐⭐ | Instant    | Instant                | Instant         | Smooth      | 10-20 MB     |
| **Medium**    | ~450 participants, 300 messages | 30      | ⭐⭐⭐⭐   | Fast       | Fast                   | Fast            | Responsive  | 30-90 MB     |
| **Large**     | ~875 participants, 750 messages | 50      | ⭐⭐⭐     | Noticeable | Noticeable             | Delayed         | Sluggish    | 100-300 MB   |
| **Spam**      | ~875 participants, 750 messages | 50      | ⭐⭐⭐     | Noticeable | Noticeable             | Delayed         | Sluggish    | 100-300 MB   |

### Performance Metrics

**App Launch Speed** - Time from app icon tap to conversation list display
**Conversation Rendering** - Time to load and display conversation list in chronological order
**Message Display** - Time for individual messages to appear when opening a conversation
**Transitions** - Speed of navigation between screens and UI state changes

### Rating Scale

⭐⭐⭐⭐⭐ - **Instant** - All interactions feel immediate and responsive

⭐⭐⭐⭐ - **Fast** - Minor delays but still feels snappy

⭐⭐⭐ - **Acceptable** - Noticeable delays but usable

⭐⭐ - **Slow** - Significant delays affecting user experience

⭐ - **Unusable** - Severe delays causing user frustration
