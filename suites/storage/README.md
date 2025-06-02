# XMTP Storage Testing Suite

Comprehensive storage analysis for XMTP applications with validated measurements and production projections.

## Core Storage Metrics (Validated)

| Operation           | Storage Cost | Scale Factor | Target  | Performance  |
| ------------------- | ------------ | ------------ | ------- | ------------ |
| **Initial Setup**   | 2.58 MB      | Front-loaded | <5 MB   | ✅ On Target |
| **DM Creation**     | 16.09 KB     | 1x baseline  | <100 KB | ✅ On Target |
| **Group Creation**  | 740.31 KB    | **46x DMs**  | <1 MB   | ✅ On Target |
| **Message Storage** | 47.28 KB     | 3x DMs       | <100 KB | ✅ On Target |
| **Group Member**    | 366.13 KB    | 23x DMs      | <500 KB | ✅ On Target |

## Production Scaling Projections

| Scale Type           | Configuration         | Storage/User | Performance  |
| -------------------- | --------------------- | ------------ | ------------ |
| **Small Scale**      | 1K DMs + 100 Groups   | ~88 MB       | ✅ On Target |
| **Medium Scale**     | 10K DMs + 1K Groups   | ~880 MB      | ✅ On Target |
| **Enterprise Scale** | 100K DMs + 10K Groups | ~8.8 GB      | ⚠️ Concern   |

## Real-World Usage Scenarios

| Use Case               | Daily Activity     | Annual Storage | Performance  |
| ---------------------- | ------------------ | -------------- | ------------ |
| **Consumer App**       | 100 DMs + 5 Groups | ~66 MB/user    | ✅ On Target |
| **Business Comms**     | 50 DMs + 20 Groups | ~384 MB/user   | ✅ On Target |
| **Community Platform** | 20 DMs + 50 Groups | ~948 MB/user   | ⚠️ Concern   |

### Running Tests

```bash
# Complete storage analysis (recommended)
yarn test suites/storage/storage.test.ts

# All storage tests
yarn test suites/storage/
```

## Storage Monitoring

### Implementation Example

```typescript
import fs from "fs";
import path from "path";

// Calculate user database size
function getUserStorageSize(userInboxId: string, env: string = "dev"): number {
  const dbPath = path.join(process.cwd(), ".data", userInboxId, env);
  return getDirSizeSync(dbPath);
}

// Format bytes for display
function formatBytes(bytes: number): string {
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}
```

---

_Storage measurements validated with XMTP node-sdk v2.0.2+ across multiple test scenarios_
