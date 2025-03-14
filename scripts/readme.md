# 📜 Scripts Documentation

This document provides practical instructions for using the scripts in the `/scripts` directory.

## Quick Reference

| Script                 | Purpose                        | Key Features                   |
| ---------------------- | ------------------------------ | ------------------------------ |
| **generateKeys.ts**    | Creates new XMTP keys          | Single key generation          |
| **generateinboxes.ts** | Creates multiple test inboxes  | Bulk account creation          |
| **hyperbrowser.ts**    | Browser automation tool        | Headless testing, screenshots  |
| **network.sh**         | Checks XMTP node status        | Network monitoring             |
| **monitor.sh**         | System monitoring              | Service status tracking        |
| **run.ts**             | General-purpose task runner    | Configurable operations        |
| **redeploy.ts**        | Redeploys a Railway deployment | Redeploys a Railway deployment |

## 🔑 Generate Keys

The `generateKeys.ts` script creates new XMTP keys for testing purposes.

```bash
# Run the script
npx ts-node scripts/generateKeys.ts
```

**Expected Result:** The script will generate and output a new XMTP private key in hex format.

**Use Cases:**

- Creating test accounts for development
- Setting up new workers for simulation testing
- Generating keys for ephemeral test instances

## 📨 Generate Inboxes

The `generateinboxes.ts` script creates multiple XMTP inboxes for testing.

```bash
# Run the script
npx ts-node scripts/generateinboxes.ts
```

**Expected Result:** The script will generate multiple XMTP inboxes and save them to `generated-inboxes.json`. Each inbox contains a private key and wallet address.

**Use Cases:**

- Setting up large-scale tests
- Preparing for load testing scenarios
- Creating a test inbox repository

## 🌐 Hyperbrowser

The `hyperbrowser.ts` script provides a headless browser automation tool for XMTP testing.

```bash
# Run the script with a specific URL
npx ts-node scripts/hyperbrowser.ts --url="https://example.com"

# Run with additional options
npx ts-node scripts/hyperbrowser.ts --url="https://example.com" --headless=false --screenshot=true
```

**Expected Result:** The script will launch a browser session to the specified URL, perform automated actions, and optionally take screenshots.

**Options:**

- `--url`: Target URL to navigate to
- `--headless`: Whether to run in headless mode (default: true)
- `--screenshot`: Whether to capture screenshots (default: false)

## 🌍 Network Monitoring

The `network.sh` script checks the status of XMTP network nodes.

```bash
# Run the script
bash scripts/network.sh
```

**Expected Result:** The script will output the status of XMTP network nodes, showing which ones are online or offline.

**Features:**

- Real-time node status checking
- Connection latency measurements
- Color-coded status indicators

## 📊 System Monitoring

The `monitor.sh` script provides system monitoring for XMTP services.

```bash
# Run the script
bash scripts/monitor.sh
```

**Expected Result:** The script will display system metrics and service status information.

**Metrics Tracked:**

- Service uptime
- Resource utilization
- Response times
- Error rates

## ⚙️ Run Script

The `run.ts` script is a general-purpose runner for XMTP-related tasks.

```bash
# Run the script
npx ts-node scripts/run.ts
```

**Expected Result:** The script will execute predefined XMTP operations based on the configuration in the file.

**Configuration:**

- Configure operations in the script file
- Set environment variables to control behavior
- Output logs to console or file

## 📁 Generated Inboxes

The `generated-inboxes.json` file contains previously generated test inboxes. This is not a script but a data file used by other scripts.

```json
// Example entry in generated-inboxes.json
{
  "address": "0x1234...",
  "privateKey": "0xabcd...",
  "inboxId": "..."
}
```

**Usage:** Reference this file in your tests when you need pre-generated XMTP accounts.

```typescript
// Example usage in tests
import inboxes from "../helpers/generated-inboxes.json";

// Use a random inbox
const randomIndex = Math.floor(Math.random() * inboxes.length);
const testAccount = inboxes[randomIndex];
```

## 🔄 Redeploy

The `redeploy.ts` script redeploys a Railway deployment.

```bash
# Run the script
npx ts-node scripts/redeploy.ts
```

## 📝 Best Practices

When using these scripts, consider the following best practices:

1. **Version Control:** Avoid committing private keys to version control
2. **Environment Variables:** Use environment variables for sensitive configuration
3. **Error Handling:** Check script outputs for errors before proceeding
4. **Resource Management:** For browser automation, ensure resources are properly closed
5. **Logging:** Enable appropriate logging for debugging issues
