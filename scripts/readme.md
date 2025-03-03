# Scripts documentation

This document provides practical instructions for using the scripts in the `/scripts` directory.

## Generate keys

The `generateKeys.ts` script creates new XMTP keys for testing purposes.

```bash
# Run the script
npx ts-node scripts/generateKeys.ts
```

**Expected result:** The script will generate and output a new XMTP private key in hex format.

## Generate inboxes

The `generateinboxes.ts` script creates multiple XMTP inboxes for testing.

```bash
# Run the script
npx ts-node scripts/generateinboxes.ts
```

**Expected result:** The script will generate multiple XMTP inboxes and save them to `generated-inboxes.json`. Each inbox contains a private key and wallet address.

## Hyperbrowser

The `hyperbrowser.ts` script provides a headless browser automation tool for XMTP testing.

```bash
# Run the script with a specific URL
npx ts-node scripts/hyperbrowser.ts --url="https://example.com"

# Run with additional options
npx ts-node scripts/hyperbrowser.ts --url="https://example.com" --headless=false --screenshot=true
```

**Expected result:** The script will launch a browser session to the specified URL, perform automated actions, and optionally take screenshots.

## Network monitoring

The `network.sh` script checks the status of XMTP network nodes.

```bash
# Run the script
bash scripts/network.sh
```

**Expected result:** The script will output the status of XMTP network nodes, showing which ones are online or offline.

## System monitoring

The `monitor.sh` script provides system monitoring for XMTP services.

```bash
# Run the script
bash scripts/monitor.sh
```

**Expected result:** The script will display system metrics and service status information.

## Run script

The `run.ts` script is a general-purpose runner for XMTP-related tasks.

```bash
# Run the script
npx ts-node scripts/run.ts
```

**Expected result:** The script will execute predefined XMTP operations based on the configuration in the file.

## Generated inboxes

The `generated-inboxes.json` file contains previously generated test inboxes. This is not a script but a data file used by other scripts.

**Usage:** Reference this file in your tests when you need pre-generated XMTP accounts.
