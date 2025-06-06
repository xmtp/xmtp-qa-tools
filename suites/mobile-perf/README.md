# Mobile Performance Test Suite

Measures application performance degradation ("slugishness") under increasing load conditions using different loads.

## Configurations

- **Small** ~20 groups, 15 messages ~ 2 MB
- **Medium** ~50 groups of various sizes with 50 messages ~ 5 MB
- **Large** ~100 groups with 15 messages ~ 10 MB
- **XL** ~200 groups with 20 messages ~ 5 MB

## How to Run

```bash
# Run individual configurations
yarn test stress
```

## History

### Mobile Performance Rating v82

| Configuration | Log in | On notif | Messages | Button Responses | Transitions | Scroll | Rating           |
| ------------- | ------ | -------- | -------- | ---------------- | ----------- | ------ | ---------------- |
| **Small**     | 4      | 4        | 3        | 4                | 5           | 4      | ⭐️⭐️⭐️ (2.83) |
| **Medium**    | 1      | 1        | 1        | 2                | 3           | 3      | ⭐️⭐️⭐️        |
| **Large**     | 1      | 1        | 1        | 1                | 1           | 1      | ⭐️              |
| **XL**        | 1      | 1        | 1        | 3                | 4           | 1      | ⭐️              |

### Mobile Performance Rating v304

| Configuration | Log in | On notif | Messages | Button Responses | Transitions | Scroll | Rating           |
| ------------- | ------ | -------- | -------- | ---------------- | ----------- | ------ | ---------------- |
| **Small**     | 4      | 4        | 3        | 4                | 5           | 4      | ⭐️⭐️⭐️ (2.83) |
| **Medium**    | 2      | 3        | 3        | 3                | 3           | 3      | ⭐️⭐️           |
| **Large**     | 1      | 1        | 1        | 1                | 1           | 1      | ⭐️              |
| **XL**        | 1      | 1        | 1        | 1                | 1           | 1      | ⭐️              |

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
