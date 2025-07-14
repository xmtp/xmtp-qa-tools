# Mobile Performance Testing Suite

This test suite measures mobile application performance degradation under increasing data load conditions, simulating real-world usage scenarios across different device capabilities and data volumes.

## What it does

- Tests application responsiveness under various conversation loads
- Measures performance across different load configurations (Small/Medium/Large/XL)
- Evaluates key mobile interaction metrics (login, notifications, messaging, UI responsiveness)
- Provides standardized performance ratings for mobile user experience
- Tracks performance regressions across application versions

## Environment Setup

Set `XMTP_ENV` to `dev` or `production` to test mobile performance on the corresponding network.

## How to run

### Run mobile performance tests

```bash
yarn test mobile
```

## Test Configurations

The suite tests four distinct load scenarios:

### Small Load Configuration

- **Groups**: ~15 groups
- **Messages**: 10-20 messages per group
- **Use Case**: Typical casual user with minimal conversation history

### Medium Load Configuration

- **Groups**: ~50 groups of various sizes
- **Messages**: 10-20 messages per group
- **Use Case**: Active user with moderate conversation activity

### Large Load Configuration

- **Groups**: ~100 groups
- **Messages**: 10-100 messages per group
- **Use Case**: Power user with extensive conversation history

### XL Load Configuration

- **Groups**: ~400 groups
- **Messages**: 20 messages per group
- **Use Case**: Enterprise or extreme usage scenarios

## Performance Metrics

Each configuration is evaluated across six key mobile interaction areas:

- **Log in** - Time from login to full display of conversation list
- **On notif** - Time for notification tap to open conversation
- **Messages** - Message rendering speed in conversation list
- **Button Responses** - UI button tap responsiveness and feedback
- **Transitions** - Navigation speed between screens (conversations ↔ messages)
- **Scroll** - UI scroll performance in conversation/message lists

## Performance Ratings

### Rating Scale

- **⭐️⭐️⭐️⭐️⭐️ (Instant)** - All interactions feel immediate and responsive
- **⭐️⭐️⭐️⭐️ (Fast)** - Minor delays but still feels snappy
- **⭐️⭐️⭐️ (Acceptable)** - Noticeable delays but usable
- **⭐️⭐️ (Slow)** - Significant delays affecting user experience
- **⭐️ (Unusable)** - Severe delays causing user frustration

### Sample Performance Results

#### Production v304 (Medium +40% improvement)

| Configuration | Log in | On notif | Messages | Button Responses | Transitions | Scroll | Overall Rating  |
| ------------- | ------ | -------- | -------- | ---------------- | ----------- | ------ | --------------- |
| **Small**     | 4      | 4        | 3        | 4                | 5           | 4      | ⭐️⭐️⭐️⭐️⭐️ |
| **Medium**    | 3      | 4        | 3        | 4                | 4           | 3      | ⭐️⭐️⭐️ (3.5) |
| **Large**     | 1      | 1        | 1        | 1                | 1           | 1      | ⭐️             |
| **XL**        | 1      | 1        | 1        | 1                | 1           | 1      | ⭐️             |

## Performance Analysis

### Optimal Performance Range

- **Small to Medium** configurations maintain acceptable performance (3+ stars)
- **Large configurations** show significant degradation (1-2 stars)
- **XL configurations** become unusable for typical mobile interactions

### Performance Recommendations

- **Target Range**: Optimize for Small-Medium load scenarios (≤50 groups)
- **Performance Threshold**: Maintain 3+ star rating for core interactions
- **Load Management**: Consider pagination/lazy loading for Large+ configurations
- **User Experience**: Implement performance warnings for extreme usage scenarios

## Key Files

- **[mobile.test.ts](./mobile.test.ts)** - Mobile performance testing implementation
- **[README.md](./README.md)** - This documentation
