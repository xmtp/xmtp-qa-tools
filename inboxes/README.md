# XMTP Inboxes

Pre-generated XMTP inbox data for testing with multiple device installations.

- [gen](./gen.ts) - Script to generate new inbox files
- **`{number}.json`** - Inbox data with specific installation counts (2, 5, 10, 15, 20, 25)
- **`run-installs.sh`** - Generation script

## Data Format

```json
{
  "accountAddress": "0x9a75c989e11bc2bd2946d9c233f6bae67d1f0fd0",
  "walletKey": "0xd620d58fd2e6fa65770ded1ea6cd25ea8b07a70cd43abed9af264a55c9b98ecc",
  "dbEncryptionKey": "f6b2a9ac52d95f41ff486d0e1b900fb831cf626b683d5b9a9448e71170c2b975",
  "inboxId": "214c1d21ded4c55d4d053090cb57821c932a58f7d53b587ca83c7db908e6650b",
  "installations": 10
}
```

## Usage

```typescript
import inboxData from "./inboxes/10.json";

const testInbox = inboxData[0];
const signer = createSigner(testInbox.walletKey);
const client = await Client.create(signer, {
  dbEncryptionKey: getEncryptionKeyFromHex(testInbox.dbEncryptionKey),
  env: "dev",
});
```

## Generate New Inboxes

```bash
./run-installs.sh
```

Generates 200 inboxes per configuration for installation counts: 10, 15, 20, 25.
