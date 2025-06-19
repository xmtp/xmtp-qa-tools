# XMTP Inboxes

Pre-generated XMTP inbox data for testing with multiple device installations.

## Files

- **`{number}.json`** - Inbox data files (e.g., `2.json`, `5.json`, `10.json`)
- **`gen.ts`** - TypeScript generator script
- **`gen.sh`** - Bash wrapper for batch generation

## Data Format

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

## Usage in Tests

```typescript
import inboxData from "./inboxes/10.json";

const testInbox = inboxData[0];
const signer = createSigner(testInbox.walletKey);
const client = await Client.create(signer, {
  dbEncryptionKey: getEncryptionKeyFromHex(testInbox.dbEncryptionKey),
  env: "dev",
});
```

## Generation Commands

### Quick Commands (Predefined)

```bash
# Generate for local environment only
yarn local-update

# Generate for all environments
yarn prod-update
```

### Direct Generation with yarn gen

```bash
# Basic usage - generates 200 inboxes with 2 installations each
yarn gen

# Custom count and installations
yarn gen --count 500 --installations 10 --envs local

# Multiple environments
yarn gen --count 200 --installations 5 --envs local,dev,production
```

### Batch Generation with gen.sh

```bash
# Generate multiple installation counts at once
./inboxes/gen.sh --envs local --installations 2,5,10,15,20,25 --count 500

# Creates: 2.json, 5.json, 10.json, 15.json, 20.json, 25.json
# Each file contains 500 accounts with respective installation counts
```

## Parameters

- **`--count`** - Number of accounts to generate (default: 200)
- **`--installations`** - Number of installations per account (default: 2)
- **`--envs`** - Target environments: `local`, `dev`, `production` (default: local)
- **`--debug`** - Enable verbose logging

## Troubleshooting

```bash
# Clean reset for local development
XMTP_ENV=local

# Remove data and restart
rm -rf .data/ logs/
./dev/down && ./dev/up

# Regenerate local inboxes
yarn local-update

# Run tests to verify
yarn functional
```
