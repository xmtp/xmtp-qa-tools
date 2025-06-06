# XMTP Large Group Testing Suite

This suite benchmarks XMTP network performance and scalability with large group conversations. It measures group creation, message delivery, metadata updates, and sync operations across varying group sizes.

## Directory Contents

- **conversations.test.ts**  
  Measures the time to add members to large groups and verifies member addition events via conversation streams.

- **messages.test.ts**  
  Benchmarks message delivery latency and reliability in large groups, using message streams to verify receipt.

- **metadata.test.ts**  
  Tests group metadata update propagation (e.g., name changes) and measures event delivery time to all members.

- **syncs.test.ts**  
  Evaluates sync performance for large groups, including cold start sync times and group creation timing.

- **cumulative_syncs.test.ts**  
  Tests cumulative sync performance as group sizes increase over time.

- **membership.test.ts**  
  Measures member addition and removal operations in large groups.

- **helpers.ts**  
  Shared utilities/constants for group creation, logging, and test parameterization (e.g., batch size, total group size).
  - Exports: `m_large_WORKER_COUNT`, `m_large_BATCH_SIZE`, `m_large_TOTAL`, `m_large_createGroup`, `saveLog`, and `SummaryEntry` type.

## Running the Suite

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install

yarn test large
```

- Results and timing summaries are appended to `logs/large.log` after each run.

## Requirements

- Ensure all required environment variables are set (see project root README for details).
- The suite uses XMTP helpers and worker abstractions; no manual configuration is needed for test users.
