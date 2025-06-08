# XMTP Inboxes

This directory contains pre-generated XMTP inbox data for testing purposes. Each JSON file contains a collection of dummy wallets with their associated XMTP credentials, organized by the number of installations per inbox.

## Files Structure

- **`{number}.json`** - JSON files containing inbox data with specific installation counts:

  - `2.json` - Inboxes with 2 installations each
  - `5.json` - Inboxes with 5 installations each
  - `10.json` - Inboxes with 10 installations each
  - `15.json` - Inboxes with 15 installations each
  - `20.json` - Inboxes with 20 installations each
  - `25.json` - Inboxes with 25 installations each

- **`run-installs.sh`** - Script to generate new inbox files with different installation configurations

## Inbox Data Format

Each JSON file contains an array of inbox objects with the following structure:

```json
{
  "accountAddress": "0x9a75c989e11bc2bd2946d9c233f6bae67d1f0fd0",
  "walletKey": "0xd620d58fd2e6fa65770ded1ea6cd25ea8b07a70cd43abed9af264a55c9b98ecc",
  "dbEncryptionKey": "f6b2a9ac52d95f41ff486d0e1b900fb831cf626b683d5b9a9448e71170c2b975",
  "inboxId": "214c1d21ded4c55d4d053090cb57821c932a58f7d53b587ca83c7db908e6650b",
  "installations": 10
}
```

### Field Descriptions

- **`accountAddress`** - Ethereum wallet address (42 characters starting with `0x`)
- **`walletKey`** - Private key for the wallet (66 characters starting with `0x`)
- **`dbEncryptionKey`** - Encryption key for XMTP local database (64 hex characters)
- **`inboxId`** - XMTP inbox identifier (64 hex characters)
- **`installations`** - Number of XMTP client installations for this inbox

## Usage in Tests

These pre-generated inboxes are used in XMTP testing scenarios to:

- Test multi-device messaging scenarios
- Simulate different installation configurations
- Provide consistent test data across test runs
- Avoid generating new wallets for each test execution

### Example Usage

```typescript
import inboxData from "./inboxes/10.json";

// Get first inbox with 10 installations
const testInbox = inboxData[0];

// Use in XMTP client creation
const signer = createSigner(testInbox.walletKey);
const client = await Client.create(signer, {
  dbEncryptionKey: getEncryptionKeyFromHex(testInbox.dbEncryptionKey),
  env: "dev",
});
```

## Generating New Inboxes

Use the provided script to generate new inbox files:

```bash
# Generate inboxes with specific installation counts
./run-installs.sh
```

The script will:

- Generate 200 inboxes per configuration
- Create files for both `local` and `production` environments
- Support installation counts: 10, 15, 20, 25
- Retry failed generations up to 3 times
- Output results to the corresponding JSON files

## Notes

- Each inbox represents a unique XMTP identity with multiple device installations
- Installation counts affect message delivery patterns and sync behavior
- These are dummy wallets for testing only - never use in production
- Files are large due to the cryptographic key data required for each inbox
