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

### Performance Metrics

- **Log in** - Time from login to full display of conversation list
- **On notif** - Time for individual notification to open a conversation.
- **Messages** - How quickly messages render in a message list
- **Button Responses** - How quickly UI buttons respond to user taps and interactions
- **Transitions** - Speed of navigation between screens (conversation and messages)
- **Scroll** - How quickly UI scrolls to the bottom of the conversation list or top for message history
- **Rating** - Overall rating of the application's performance based on the above metrics

### Rating Scale

- ⭐️⭐️⭐️⭐️⭐️ - **Instant** - All interactions feel immediate and responsive
- ⭐️⭐️⭐️⭐️ - **Fast** - Minor delays but still feels snappy
- ⭐️⭐️⭐️ - **Acceptable** - Noticeable delays but usable
- ⭐️⭐️ - **Slow** - Significant delays affecting user experience
- ⭐️ - **Unusable** - Severe delays causing user frustration
