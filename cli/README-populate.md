# Using Send Command for Self-Population

## Overview

Instead of a separate `populate` method, use the existing `yarn send` command to send messages to a worker's own address.

## Send Command

The `yarn send` command can send messages to any target, including a worker's own address:

```bash
# Send to any address
yarn send --target 0xf1be9a945de5e4e270321cf47672f82380fd3463 --env dev --users 100

# Send to a group
yarn send --group-id fa5d8fc796bb25283dccbc1823823f75 --env production --message "Hello group!"

# Send to worker's own address (self-population)
yarn send --target 0xfb55CB623f2aB58Da17D8696501054a2ACeD1944 --env dev --users 3
```

## Getting Worker Address

To get a worker's address for self-population:

```typescript
import { getWorkers } from "@workers/manager";
import { type XmtpEnv } from "@workers/versions";

// Create a worker
const workerManager = await getWorkers(1, {
  env: "dev" as XmtpEnv,
  useVersions: false,
});

const worker = workerManager.getAll()[0];
console.log(`Worker address: ${worker.worker.address}`);

// Use the address with send command
// yarn send --target ${worker.worker.address} --env dev --users 5
```

## Usage Examples

### Basic self-population:

```bash
# Send 10 messages to worker's own address
yarn send --target 0xfb55CB623f2aB58Da17D8696501054a2ACeD1944 --env dev --users 10
```

### With custom messages:

```bash
# Send custom messages to self
yarn send --target 0xfb55CB623f2aB58Da17D8696501054a2ACeD1944 --env dev --users 5 --custom-message "test-message"
```

### With response waiting:

```bash
# Send and wait for responses
yarn send --target 0xfb55CB623f2aB58Da17D8696501054a2ACeD1944 --env dev --users 3 --wait
```

## Example Output

```
🚀 Testing 3 users on dev with 1 attempt(s)
📤 Send-only mode (no response waiting)
🧹 Cleaning up send test database files...
🗑️  Removed: 0 send test database files

🔄 Starting attempt 1/1...
📋 Initialized 3 workers for attempt 1
📩 0: Attempt 1, Message sent in 45ms
📩 1: Attempt 1, Message sent in 38ms
📩 2: Attempt 1, Message sent in 42ms
✅ 0: Attempt 1, Send=45ms (no await)
✅ 1: Attempt 1, Send=38ms (no await)
✅ 2: Attempt 1, Send=42ms (no await)
📊 Attempt 1: 3/3 successful (100.0%)
🧹 Cleaned up workers for attempt 1

📊 Summary:
   Attempts: 1
   Workers per attempt: 3
   Total operations: 3
   Successful: 3
   Failed: 0
   Success Rate: 100.0%
   Duration: 2.34s
   Avg Send Time: 0.04s
🎯 Success threshold (95%) reached!
```

## Advantages

- **No additional code** - Uses existing, tested send functionality
- **Full feature set** - All send options available (custom messages, response waiting, etc.)
- **Consistent behavior** - Same logic as other send operations
- **Easy to use** - Just need the worker's address
