# Mobile Performance Test Suite

Measures application performance degradation ("slugishness") under increasing load conditions using different loads.

## Configurations

- **Small** ~15 groups, 10,20 messages
- **Medium** ~50 groups of various sizes with 10,20 messages
- **Large** ~100 groups with 10,20,100 messages
- **XL** ~400 groups with 20 messages

## How to Run

```bash
# Run individual configurations
yarn test stress
```

## Mobile Performance Rating

#### Prod v82

| Configuration | Log in | On notif | Messages | Button Responses | Transitions | Scroll | Rating          |
| ------------- | ------ | -------- | -------- | ---------------- | ----------- | ------ | --------------- |
| **Small**     | 4      | 4        | 3        | 4                | 5           | 4      | ⭐️⭐️⭐️⭐️⭐️ |
| **Medium**    | 2      | 3        | 2        | 2                | 3           | 3      | ⭐️⭐️ (2.5)    |
| **Large**     | 1      | 1        | 1        | 1                | 1           | 1      | ⭐️             |
| **XL**        | 1      | 1        | 1        | 1                | 1           | 1      | ⭐️             |

#### Prod v304 (Medium +40%)

| Configuration | Log in | On notif | Messages | Button Responses | Transitions | Scroll | Rating          |
| ------------- | ------ | -------- | -------- | ---------------- | ----------- | ------ | --------------- |
| **Small**     | 4      | 4        | 3        | 4                | 5           | 4      | ⭐️⭐️⭐️⭐️⭐️ |
| **Medium**    | 3      | 4        | 3        | 4                | 4           | 3      | ⭐️⭐️⭐️ (3.5) |
| **Large**     | 1      | 1        | 1        | 1                | 1           | 1      | ⭐️             |
| **XL**        | 1      | 1        | 1        | 1                | 1           | 1      | ⭐️             |

The Medium configuration now performs significantly better, moving from a 2-3 star rating to a solid 4-star rating with consistent performance across all metrics.

### Performance Metrics

- **Log in** - Time from app icon tap to conversation list display
- **On notif** - Time for individual messages to appear when opening a conversation.
- **Messages** - How quickly UI buttons respond to user taps and interactions.
- **Button Responses** - Time to open app from push notification after being closed/backgrounded.
- **Transitions** - Speed of navigation between screens and UI state changes.
- **Scroll** - How quickly UI scrolls to the bottom of the conversation

### Rating Scale

- ⭐️⭐️⭐️⭐️⭐️ - **Instant** - All interactions feel immediate and responsive
- ⭐️⭐️⭐️⭐️ - **Fast** - Minor delays but still feels snappy
- ⭐️⭐️⭐️ - **Acceptable** - Noticeable delays but usable
- ⭐️⭐️ - **Slow** - Significant delays affecting user experience
- ⭐️ - **Unusable** - Severe delays causing user frustration
