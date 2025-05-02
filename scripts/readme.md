# 📜 Scripts documentation

This document provides practical instructions for using the scripts in the `/scripts` directory.

## Quick reference

| Script                     | Purpose                           | Key Features                            |
| -------------------------- | --------------------------------- | --------------------------------------- |
| **balances.ts**            | Checks wallet balances            | ETH/USDC balance monitoring             |
| **bot-cli.ts**             | Command-line interface for bots   | Send XMTP messages from CLI             |
| **createinstallations.ts** | Creates XMTP client installations | Multiple client installation creator    |
| **generateKeys.ts**        | Creates new XMTP keys             | Single key generation                   |
| **generate.ts**            | Creates test data                 | Test data generation                    |
| **local-update.ts**        | Updates local inboxes             | Local environment configuration         |
| **monitor.sh**             | System monitoring                 | Service status tracking                 |
| **network.sh**             | Checks XMTP node status           | Network monitoring                      |
| **oldpackages.ts**         | Old packages creation             | Old packages creation                   |
| **packages.sh**            | Manages packages                  | Package management                      |
| **railway.sh**             | Railway deployment script         | Railway management                      |
| **railway-test.ts**        | Tests Railway deployments         | Railway testing                         |
| **redeploy.ts**            | Redeploys a Railway deployment    | Redeploys a Railway deployment          |
| **run.ts**                 | General-purpose task runner       | Configurable operations                 |
| **run-bot.ts**             | Runs XMTP bots                    | Bot execution with arguments            |
| **run-script.ts**          | Script execution helper           | Runs TypeScript scripts with watch mode |
| **run-test.sh**            | Runs tests                        | Test execution                          |
| **update.ts**              | Updates dependencies              | Dependency management                   |
| **versions.ts**            | Manages SDK versions              | XMTP SDK version management/symlinks    |
| **ts200.ts**               | Test 200                          | Test 200                                |

## Usage

You can run these scripts using the yarn commands defined in package.json:

```bash
# Generate XMTP keys
yarn gen:keys

# Monitor development environment
yarn monitor:dev

# Run a specific script without the extension
yarn script <script-name>

# Run a bot with arguments
yarn bot <bot-name> [args]
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

## 💰 Wallet balances

The `balances.ts` script checks ETH and USDC balances for a list of Ethereum addresses.

```bash
# Run the script
yarn script balances
```

**Expected result:** The script will display a table of wallet addresses with their ETH and USDC balances, calculating USD values.

**Features:**

- ETH balance checking
- USDC token balance checking
- USD value calculation
- CSV export option

## 🤖 Bot CLI

The `bot-cli.ts` script provides a command-line interface for sending XMTP messages.

```bash
# Run the script
yarn script bot-cli <target_address> <message>
```

**Expected result:** The script will send an XMTP message to the specified wallet address.

**Use cases:**

- Testing XMTP message delivery
- Sending notifications from scripts
- Command-line interaction with XMTP network

## 🏗️ Create installations

The `createinstallations.ts` script creates multiple XMTP client installations for the same account.

```bash
# Run the script
yarn script createinstallations
```

**Expected result:** The script will generate multiple XMTP client installations and save their details.

**Features:**

- Creates multiple client instances
- Saves installation IDs
- Useful for testing multi-device scenarios

## 🔄 Local update

The `local-update.ts` script initializes and updates XMTP inboxes in a local environment.

```bash
# Run the script
yarn script local-update
```

**Expected result:** The script will initialize XMTP clients in a local environment using generated inboxes.

**Features:**

- Sets up local database paths
- Initializes XMTP clients
- Verifies inbox IDs
- Saves configuration for reuse

## 🚂 Railway deployment

The `railway.sh`, `railway-test.ts`, and `redeploy.ts` scripts manage Railway deployments.

```bash
# Run railway.sh
yarn script railway

# Run redeploy.ts
yarn script redeploy
```

## 🤖 Run bot

The `run-bot.ts` script executes XMTP bots with optional arguments.

```bash
# Run a bot
yarn bot <bot-name> [args]

# Example with arguments
yarn bot stress 5
```

**Expected result:** The script will run the specified bot with any provided arguments.

**Features:**

- Automatic bot discovery in the bots/ directory
- Passes command-line arguments to the bot
- Watch mode for development

## 🔄 Run script

The `run-script.ts` helper executes TypeScript scripts with watch mode enabled.

```bash
# Run a script
yarn script <script-name>
```

**Expected result:** The script will execute the specified TypeScript script with watch mode enabled.

**Features:**

- Automatic script discovery
- Watch mode for development
- Error handling for missing scripts

## 📚 SDK versions

The `versions.ts` script manages XMTP SDK versions and creates necessary symlinks.

```bash
# Run the script
yarn script versions
```

**Expected result:** The script will discover installed XMTP SDK versions and create proper symlinks for their operation.

**Features:**

- Auto-discovers SDK packages
- Creates symlinks for node bindings
- Verifies package versions
- Ensures proper SDK version resolution

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
