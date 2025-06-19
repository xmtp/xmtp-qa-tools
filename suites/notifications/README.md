# Specialized Testing Suite

This test suite contains specialized test cases for edge scenarios and specific use cases not covered by other test suites.

## What it does (units)

- Test push notification functionality and delivery
- Validate rate limiting mechanisms and throttling behavior
- Test edge cases and specialized scenarios

## Environment Setup

Set `XMTP_ENV` to either `dev` or `production` to test against the corresponding network.

## How to run

### Run all specialized tests

```bash
yarn test other
```

### Run specific test files

```bash
yarn test other/notifications.test.ts
yarn test other/rate-limited.test.ts
```

## Configuration

These tests may use environment-specific configurations and specialized worker setups for testing edge cases and specific functionality.

## Key files

- **[notifications.test.ts](./notifications.test.ts)** - Push notification functionality testing
- **[rate-limited.test.ts](./rate-limited.test.ts)** - Rate limiting and throttling validation
