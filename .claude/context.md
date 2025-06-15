# XMTP QA Tools Repository Context

This repository contains testing tools and frameworks for XMTP (Extensible Message Transport Protocol).

## IMPORTANT

- Only use `YARN`

## Repository Structure

### Key Directories

- `suites/` - Test suites organized by category (functional, group, large, etc.)
- `workers/` - Worker thread management for parallel testing
- `helpers/` - Shared utility functions and client helpers
- `bots/` - XMTP bot implementations
- `inboxes/` - Inbox management and dummy wallet data
- `logs/` - Test execution logs
- `scripts/` - CLI and utility scripts

### Core Testing Framework

#### Worker Testing Pattern

```typescript
// Standard pattern for test initialization
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";

const testName = "my-test";
loadEnv(testName);

const workers = await getWorkers(["alice", "bob"], testName);
setupTestLifecycle({ expect, workers, testName });

// Access workers
const alice = workers.get("alice");
const bob = workers.get("bob");
```

#### XMTP Client Patterns

```typescript
// Client creation with encryption
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";

const signer = createSigner(WALLET_KEY);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
const client = await Client.create(signer, {
  dbEncryptionKey: encryptionKey,
  env: XMTP_ENV as XmtpEnv,
});
```

### Common Data Fetching Patterns

#### Environment Variables

- `WALLET_KEY` - Private key for XMTP client
- `ENCRYPTION_KEY` - Database encryption key
- `XMTP_ENV` - Environment (local, dev, production)
- `DATADOG_API_KEY` - For metrics integration

#### Log Analysis

- Vitest test outputs go to `logs/` directory
- Use `yarn test` command for running test suites
- Test logs contain XMTP message flows, database operations, worker status

#### Data Sources

- Test worker databases in `.data/` directory
- Inbox data from `inboxes/inboxes.json` (600 dummy wallets)
- Datadog metrics via `datadog-metrics` package
- Log files in `logs/` directory

### XMTP-Specific Concepts

#### Key Identifiers

- **Inbox ID**: 64-char hex, primary identifier for conversations
- **Installation ID**: 64-char hex, identifies client installation
- **Ethereum Address**: 0x + 40 hex chars, wallet address
- **Private Key**: 0x + 64 hex chars, for signing
- **Encryption Key**: 64 hex chars (no 0x), for database encryption

#### Message Types

- Text messages with content type "text"
- Group conversations vs Direct Messages (DMs)
- Message streams for real-time processing

#### Common Error Patterns

- `AlreadyProcessed XMTP` - Normal message processing, not an error
- `SQLCipher HMAC` failures - Database encryption issues
- `Database connection` problems - Connection pool or timeout issues
- `Worker thread` errors - Testing framework issues
- Network timeouts to `grpc.dev.xmtp.network`

### Testing Commands

```bash
# Run specific test suites
yarn test dms
yarn test suites/group/
yarn large  # Large test suite
yarn functional  # Functional tests

# Utility commands
yarn gen  # Generate test data
yarn clean  # Clean test data
yarn lint  # Code linting
yarn format  # Code formatting

# CLI tool
yarn test <test-name>
yarn bot <bot-command>
yarn script <script-name>
```

### Integration Points

#### Datadog Metrics

- Configured via `datadog-metrics` package
- Sends test execution metrics and error rates
- Monitor network connectivity and test health

#### Database Storage

- Each worker gets isolated database in `.data/`
- SQLCipher encryption for security
- Persistent storage between test runs

#### Multi-Environment Support

- Local development environment
- Dev environment (grpc.dev.xmtp.network)
- Production environment testing

### When Helping Users

1. **For test failures**: Check logs in `logs/` directory, analyze worker status
2. **For XMTP errors**: Understand message flow, check network connectivity
3. **For database issues**: Look at encryption keys, connection pools
4. **For worker problems**: Check worker initialization, cleanup processes
5. **For environment issues**: Verify .env setup, network access

### File Reading Priorities

When analyzing issues:

1. Recent log files in `logs/` directory
2. Test files in `suites/` for context
3. Helper functions in `helpers/` for patterns
4. Worker configuration in `workers/` for setup
5. Environment files (.env) for configuration

This context helps Claude understand the XMTP testing ecosystem and provide relevant assistance.
