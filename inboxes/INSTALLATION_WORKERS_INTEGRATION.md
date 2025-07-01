# XMTP Installation → Workers Framework Integration

This document explains how to start XMTP installations using the workers framework through naming conventions.

## Overview

The XMTP installations can be seamlessly integrated with the workers framework by:
1. **Naming Convention Mapping**: Installations map to worker names (installation-1 → inst1, installation-2 → inst2, etc.)
2. **Environment Variable Setup**: Installation credentials are set as environment variables for workers
3. **Automatic Discovery**: Workers framework automatically finds and uses installation data

## Available Installations

We have 10 pre-generated installations with realistic database content:

```
1. inst1 - 0x79cd2e5a08082f293331334e76318d6b3e9994a1 (200 groups, 40,000 conversations)
2. inst2 - 0xacbe019548c58c3e45f5b8bdd8743c42a34f0706 (200 groups, 40,000 conversations)
3. inst3 - 0x1234567890abcdef1234567890abcdef12345678 (200 groups, 40,000 conversations)
... and 7 more installations
```

## Quick Start

### 1. List Available Installations

```bash
npx tsx inboxes/start-installation-simple.ts
```

### 2. Prepare Installations for Workers

```typescript
import { prepareInstallationForWorkers } from "./start-installation-simple";

// Prepare installation 1 for workers framework
const { workerName, installation } = prepareInstallationForWorkers(1, "local");
// This sets WALLET_KEY_INST1 and ENCRYPTION_KEY_INST1 environment variables
```

### 3. Use with Workers Framework

```typescript
import { getWorkers } from "@workers/manager";

// After preparing installations, create workers using the naming convention
const workers = await getWorkers(["inst1", "inst2", "inst3"], "my-test");

// Workers automatically use installation data
const worker1 = workers.get("inst1"); // Uses installation-1 data
const worker2 = workers.get("inst2"); // Uses installation-2 data
const worker3 = workers.get("inst3"); // Uses installation-3 data
```

## Naming Convention

| Installation | Worker Name | Environment Variables |
|-------------|-------------|----------------------|
| installation-1 | inst1 | WALLET_KEY_INST1, ENCRYPTION_KEY_INST1 |
| installation-2 | inst2 | WALLET_KEY_INST2, ENCRYPTION_KEY_INST2 |
| installation-3 | inst3 | WALLET_KEY_INST3, ENCRYPTION_KEY_INST3 |
| ... | ... | ... |

## Files

- `inboxes/installations/` - Installation database files and metadata
- `inboxes/start-installation-simple.ts` - Setup utilities for workers integration
- `inboxes/test-installation-with-workers.test.ts` - Complete test demonstrating the integration

## Running Tests

```bash
# Demonstrate the concept
yarn test:installations

# Run full integration test with workers framework
yarn test:installations-workers
```

## Example Integration Test

The integration test shows:

1. **Environment Setup**: Installing credentials are loaded into environment variables
2. **Worker Creation**: Workers are created using installation names (inst1, inst2, inst3)
3. **Data Loading**: Workers automatically load existing installation data
4. **Group Creation**: Workers can create groups between installations
5. **Message Sending**: Workers can send messages using installation identities

## Key Benefits

✅ **No Manual Key Management**: Installation credentials are automatically mapped  
✅ **Pre-existing Data**: Workers load existing conversations and groups from installations  
✅ **Multi-Installation Testing**: Easy to test scenarios across multiple installations  
✅ **Consistent Naming**: Simple inst1, inst2, inst3... naming convention  
✅ **Framework Integration**: Full compatibility with existing workers framework features  

## Architecture

```
Installation Files                Workers Framework
├── installation-1-local/    →    inst1 worker
├── installation-2-local/    →    inst2 worker  
├── installation-3-local/    →    inst3 worker
└── installations-local.json      (metadata for mapping)
```

The solution uses naming conventions to bridge between the installation system and the workers framework, making it easy to start installations as workers without manual configuration.