# Inboxes

Pre-generated XMTP inbox data for testing with multiple device installations.

## Files

- **`byinstallation/{number}.json`** - Inbox data files organized by installation count (e.g., `2.json`, `5.json`, `10.json`)

## Data format

Each JSON file contains an array of inbox objects:

```json
{
  "accountAddress": "0x9a75c989e11bc2bd2946d9c233f6bae67d1f0fd0",
  "walletKey": "0xd620d58fd2e6fa65770ded1ea6cd25ea8b07a70cd43abed9af264a55c9b98ecc",
  "dbEncryptionKey": "f6b2a9ac52d95f41ff486d0e1b900fb831cf626b683d5b9a9448e71170c2b975",
  "inboxId": "214c1d21ded4c55d4d053090cb57821c932a58f7d53b587ca83c7db908e6650b",
  "installations": 10
}
```

## Usage in tests

```typescript
import inboxData from "./inboxes/byinstallation/10.json";

const testInbox = inboxData[0];
const signer = createSigner(testInbox.walletKey);
const client = await Client.create(signer, {
  dbEncryptionKey: getEncryptionKeyFromHex(testInbox.dbEncryptionKey),
  env: "dev",
  disableDeviceSync: true,
  appVersion: "agent-name/1.0.0",
});
```

## Generation commands

### Basic generation

```bash
# Basic usage - generates 200 inboxes with 2 installations each
yarn gen

# Custom count and installations
yarn gen --count 500 --installations 10 --env local

# Multiple environments
yarn gen --installations 5 --env local,dev,production
```

### Check installation status

Use `--check` to verify installations are valid without modifying anything:

```bash
# Check first 20 inboxes on dev
yarn gen --check --count 20 --env dev

# Check first 50 inboxes on production
yarn gen --check --count 50 --env production
```

Output shows a table with:
- **Installs** - Total installations registered for the inbox
- **Valid** - Installations with valid key packages
- **Invalid** - Installations with expired/stale key packages
- **Status** - OK, Missing (fewer valid than expected), Stale (has invalid), or None

### Restart/refresh installations

Use `--restart` to revoke existing installations and create fresh ones:

```bash
# Restart first 50 inboxes on dev
yarn gen --restart --count 50 --env dev

# Restart with smaller batch size (for CI/memory-constrained environments)
yarn gen --restart --count 50 --batch-size 5 --env dev

# Restart on multiple environments
yarn gen --restart --count 200 --env dev,production
```

The restart process:
1. Creates a client (registers new installation)
2. Calls `revokeAllOtherInstallations()` to revoke all others
3. Creates additional installations to reach the target count

### Batching for memory management

The `--batch-size` parameter controls how many inboxes are processed at once:

```bash
# Default batch size (10 inboxes at a time)
yarn gen --restart --count 100 --env production

# Smaller batches for CI environments with memory limits
yarn gen --restart --count 100 --batch-size 5 --env production
```

Between batches:
- Database files are cleaned up to free mlock memory
- Garbage collection is triggered if available
- 1 second delay allows resources to settle

This prevents `sqlcipher_mlock` errors in memory-constrained environments like GitHub Actions.

## Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--count` | Number of accounts to process | 200 |
| `--installations` | Installations per account | 2 |
| `--env` | Target environments (comma-separated) | local |
| `--batch-size` | Inboxes per batch (memory management) | 10 |
| `--restart` | Force revoke and recreate installations | false |
| `--check` | Check status without modifying | false |
| `--debug` | Enable verbose logging | false |
| `--clean` | Clean logs/ and .data/ directories | false |

## GitHub Actions

The `monthly-inbox-restart.yml` workflow automatically refreshes installations:

```yaml
yarn gen --installations 2 --count 50 --restart --batch-size 5 --env ${{ matrix.env }}
```

Uses small batch size (5) to avoid memory issues in CI.
