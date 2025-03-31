# 📜 Scripts documentation

This document provides practical instructions for using the scripts in the `/scripts` directory.

## Quick reference

| Script              | Purpose                        | Key Features                   |
| ------------------- | ------------------------------ | ------------------------------ |
| **generateKeys.ts** | Creates new XMTP keys          | Single key generation          |
| **generate.ts**     | Creates test data              | Test data generation           |
| **hyperbrowser.ts** | Browser automation tool        | Headless testing, screenshots  |
| **monitor.sh**      | System monitoring              | Service status tracking        |
| **network.sh**      | Checks XMTP node status        | Network monitoring             |
| **oldpackages.ts**  | Old packages creation          | Old packages creation          |
| **packages.sh**     | Manages packages               | Package management             |
| **railway.sh**      | Railway deployment script      | Railway management             |
| **railway-test.ts** | Tests Railway deployments      | Railway testing                |
| **redeploy.ts**     | Redeploys a Railway deployment | Redeploys a Railway deployment |
| **run.ts**          | General-purpose task runner    | Configurable operations        |
| **run-test.sh**     | Runs tests                     | Test execution                 |
| **update.ts**       | Updates dependencies           | Dependency management          |

## Available commands

You can run these scripts using the yarn commands defined in package.json:

```bash
# Generate XMTP keys
yarn gen:keys

# Monitor development environment
yarn monitor:dev

# Send data to Datadog
yarn script datadog

# Generate test data
yarn script generate

# Monitor network status
yarn script monitor

# Manage old packages
yarn script oldpackages

# Manage packages
yarn script packages

# Manage Railway deployments
yarn script railway

# Record browser interactions with Playwright
yarn script record

# Redeploy services
yarn script redeploy

# Update dependencies
yarn script update
```

## 🔑 Generate keys

The `generateKeys.ts` script creates new XMTP keys for testing purposes.

```bash
# Run the script
yarn gen:keys
```

**Expected result:** The script will generate and output a new XMTP private key in hex format.

**Use cases:**

- Creating test accounts for development
- Setting up new workers for simulation testing
- Generating keys for ephemeral test instances

## 🔄 Generate test data

The `generate.ts` script creates test data for XMTP testing.

```bash
# Run the script
yarn script generate
```

**Expected result:** The script will generate test data according to its configuration.

## 🌐 Hyperbrowser

The `hyperbrowser.ts` script provides a headless browser automation tool for XMTP testing.

```bash
# Run the script with a specific URL
yarn tsx scripts/hyperbrowser.ts --url="https://example.com"

# Run with additional options
yarn tsx scripts/hyperbrowser.ts --url="https://example.com" --headless=false --screenshot=true
```

**Expected result:** The script will launch a browser session to the specified URL, perform automated actions, and optionally take screenshots.

**Options:**

- `--url`: Target URL to navigate to
- `--headless`: Whether to run in headless mode (default: true)
- `--screenshot`: Whether to capture screenshots (default: false)

## 🌍 Network monitoring

The `network.sh` script checks the status of XMTP network nodes.

```bash
# Run the script
yarn script monitor
```

**Expected result:** The script will output the status of XMTP network nodes, showing which ones are online or offline.

**Features:**

- Real-time node status checking
- Connection latency measurements
- Color-coded status indicators

## 📊 System monitoring

The `monitor.sh` script provides system monitoring for XMTP services.

```bash
# Run the script
bash scripts/monitor.sh
```

**Expected result:** The script will display system metrics and service status information.

**Metrics tracked:**

- Service uptime
- Resource utilization
- Response times
- Error rates

## 📦 Package management

The `packages.sh` and `oldpackages.ts` scripts help manage package dependencies.

```bash
# Run packages.sh
yarn script packages

# Run oldpackages.ts
yarn script oldpackages
```

## 🚂 Railway deployment

The `railway.sh`, `railway-test.ts`, and `redeploy.ts` scripts manage Railway deployments.

```bash
# Run railway.sh
yarn script railway

# Run redeploy.ts
yarn script redeploy
```

## 🔄 Update dependencies

The `update.ts` script helps update project dependencies.

```bash
# Run the script
yarn script update
```

## ⚙️ Run script

The `run.ts` script is a general-purpose runner for XMTP-related tasks.

```bash
# Run the script
yarn tsx scripts/run.ts
```

**Expected result:** The script will execute predefined XMTP operations based on the configuration in the file.

**Configuration:**

- Configure operations in the script file
- Set environment variables to control behavior
- Output logs to console or file

## 🧪 Run tests

The `run-test.sh` script executes tests for the project.

```bash
# Run the script
bash scripts/run-test.sh
```

## 📝 Best practices

When using these scripts, consider the following best practices:

1. **Version control:** Avoid committing private keys to version control
2. **Environment variables:** Use environment variables for sensitive configuration
3. **Error handling:** Check script outputs for errors before proceeding
4. **Resource management:** For browser automation, ensure resources are properly closed
5. **Logging:** Enable appropriate logging for debugging issues
