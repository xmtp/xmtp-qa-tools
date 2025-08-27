import {
  APP_VERSION,
  IdentifierKind,
  type XmtpEnv,
} from "version-management/client-versions";
import "dotenv/config";
import {
  createSigner,
  generateEncryptionKeyHex,
  getEncryptionKeyFromHex,
} from "@helpers/client";
import { Client } from "version-management/client-versions";
import { generatePrivateKey } from "viem/accounts";

interface Config {
  env: string;
  target?: string;
  message?: string;
  name?: string;
  list: boolean;
  revoke?: string;
  create: boolean;
  load?: string;
  walletKey?: string;
  encryptionKey?: string;
}

function showHelp() {
  console.log(`
XMTP Installations CLI - Manage installations and send messages

USAGE:
  yarn installations [options]

OPTIONS:
  --create                    Create a new installation
  --name <name>              Name for the installation (default: random)
  --target <address>         Target wallet address to send message to
  --message <text>           Message to send to target
  --list                     List all installations
  --revoke <installation-id> Revoke a specific installation
  --load <name>              Load existing installation by name
  --wallet-key <key>         Wallet private key (for loading existing installation)
  --encryption-key <key>     Encryption key (for loading existing installation)
  --env <environment>        XMTP environment (local, dev, production) [default: production]
  -h, --help                 Show this help message

EXAMPLES:
  # Create a new installation
  yarn installations --create

  # Create installation with custom name
  yarn installations --create --name "my-installation"

  # Create installation and send message
  yarn installations --create --target 0x1234... --message "Hello!"

  # List all installations
  yarn installations --list

  # Load existing installation by name
  yarn installations --load "my-installation"

  # Send message using saved installation
  yarn installations --load "my-installation" --target 0x1234... --message "Hello!"

  # Send message using provided keys
  yarn installations --wallet-key 0x... --encryption-key ... --target 0x1234... --message "Hello!"

  # Revoke an installation
  yarn installations --revoke abc123...

ENVIRONMENT VARIABLES:
  XMTP_ENV                   Default environment

For more information, see: cli/readme.md
`);
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    env: process.env.XMTP_ENV ?? "production",
    list: false,
    create: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    } else if (arg === "--create") {
      config.create = true;
    } else if (arg === "--name" && nextArg) {
      config.name = nextArg;
      i++;
    } else if (arg === "--target" && nextArg) {
      config.target = nextArg;
      i++;
    } else if (arg === "--message" && nextArg) {
      config.message = nextArg;
      i++;
    } else if (arg === "--list") {
      config.list = true;
    } else if (arg === "--revoke" && nextArg) {
      config.revoke = nextArg;
      i++;
    } else if (arg === "--env" && nextArg) {
      config.env = nextArg;
      i++;
    } else if (arg === "--load" && nextArg) {
      config.load = nextArg;
      i++;
    } else if (arg === "--wallet-key" && nextArg) {
      config.walletKey = nextArg;
      i++;
    } else if (arg === "--encryption-key" && nextArg) {
      config.encryptionKey = nextArg;
      i++;
    }
  }

  // Validation
  if (
    !config.create &&
    !config.list &&
    !config.revoke &&
    !config.target &&
    !config.load
  ) {
    console.error(
      "❌ Error: Must specify --create, --list, --revoke, --target, or --load",
    );
    process.exit(1);
  }

  if (config.message && !config.target) {
    console.error("❌ Error: --message requires --target");
    process.exit(1);
  }

  return config;
}

async function createInstallation(config: Config): Promise<void> {
  console.log(`🔧 Creating new installation on ${config.env}...`);

  // Generate keys
  const walletKey = generatePrivateKey();
  const encryptionKey = generateEncryptionKeyHex();

  // Create signer and client
  const signer = createSigner(walletKey);
  const dbEncryptionKey = getEncryptionKeyFromHex(encryptionKey);

  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: config.env as XmtpEnv,
    appVersion: APP_VERSION,
  });

  const identifier = await signer.getIdentifier();
  console.log(`✅ Installation created successfully!`);
  console.log(`📋 Installation ID: ${client.installationId}`);
  console.log(`📬 Inbox ID: ${client.inboxId}`);
  console.log(`🔑 Wallet Address: ${identifier.identifier}`);
  console.log(`\n💾 Keys (save these for future use):`);
  console.log(`WALLET_KEY=${walletKey}`);
  console.log(`ENCRYPTION_KEY=${encryptionKey}`);

  // Save to file if name provided
  if (config.name) {
    const fs = await import("fs");
    const path = await import("path");

    const dataDir = path.resolve(".data/installations");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, `${config.name}.json`);
    const data = {
      name: config.name,
      installationId: client.installationId,
      inboxId: client.inboxId,
      walletKey,
      encryptionKey,
      address: identifier.identifier,
      env: config.env,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`💾 Saved to: ${filePath}`);
  }

  // Send message if target specified
  if (config.target && config.message) {
    await sendMessage(client, config.target, config.message);
  }
}

async function sendMessage(
  client: Client,
  target: string,
  message: string,
): Promise<void> {
  console.log(`📤 Sending message to ${target}...`);

  try {
    // Create conversation
    const conversation = await client.conversations.newDmWithIdentifier({
      identifier: target,
      identifierKind: IdentifierKind.Ethereum,
    });

    // Send message
    const sendStart = Date.now();
    await conversation.send(message);
    const sendTime = Date.now() - sendStart;

    console.log(`✅ Message sent successfully in ${sendTime}ms`);
    console.log(`💬 Message: "${message}"`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to send message: ${errorMessage}`);
  }
}

async function listInstallations(): Promise<void> {
  console.log(`📋 Listing installations...`);

  const fs = await import("fs");
  const path = await import("path");

  const dataDir = path.resolve(".data/installations");
  if (!fs.existsSync(dataDir)) {
    console.log(`📁 No installations directory found at ${dataDir}`);
    return;
  }

  const files = fs
    .readdirSync(dataDir)
    .filter((file) => file.endsWith(".json"));

  if (files.length === 0) {
    console.log(`📁 No saved installations found`);
    return;
  }

  console.log(`📋 Found ${files.length} installation(s):\n`);

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    console.log(`📁 ${data.name || file.replace(".json", "")}`);
    console.log(`   Installation ID: ${data.installationId}`);
    console.log(`   Inbox ID: ${data.inboxId}`);
    console.log(`   Address: ${data.address}`);
    console.log(`   Environment: ${data.env}`);
    console.log(`   Created: ${data.createdAt}`);
    console.log("");
  }
}

function revokeInstallation(installationId: string): void {
  console.log(`🗑️  Revoking installation ${installationId}...`);

  // This would require the original keys to revoke
  // For now, just show instructions
  console.log(
    `⚠️  To revoke an installation, you need the original wallet key and encryption key.`,
  );
  console.log(`📋 Installation ID: ${installationId}`);
  console.log(`💡 Use the saved keys from when the installation was created.`);
}

async function loadInstallation(config: Config): Promise<Client> {
  if (config.load) {
    // Load from saved file
    const fs = await import("fs");
    const path = await import("path");

    const dataDir = path.resolve(".data/installations");
    const filePath = path.join(dataDir, `${config.load}.json`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Installation "${config.load}" not found`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      name: string;
      walletKey: string;
      encryptionKey: string;
      env: string;
    };
    console.log(`📂 Loading installation: ${data.name}`);

    const signer = createSigner(data.walletKey);
    const dbEncryptionKey = getEncryptionKeyFromHex(data.encryptionKey);

    return await Client.create(signer, {
      dbEncryptionKey,
      env: data.env as XmtpEnv,
      appVersion: APP_VERSION,
    });
  } else if (config.walletKey && config.encryptionKey) {
    // Load from provided keys
    console.log(`🔑 Loading installation from provided keys...`);

    const signer = createSigner(config.walletKey);
    const dbEncryptionKey = getEncryptionKeyFromHex(config.encryptionKey);

    return await Client.create(signer, {
      dbEncryptionKey,
      env: config.env as XmtpEnv,
      appVersion: APP_VERSION,
    });
  } else {
    throw new Error(
      "Must provide either --load <name> or both --wallet-key and --encryption-key",
    );
  }
}

async function main(): Promise<void> {
  const config = parseArgs();

  try {
    if (config.create) {
      await createInstallation(config);
    } else if (config.list) {
      await listInstallations();
    } else if (config.revoke) {
      revokeInstallation(config.revoke);
    } else if (config.target && config.message) {
      // Load existing installation and send message
      const client = await loadInstallation(config);
      await sendMessage(client, config.target, config.message);
    } else if (config.load) {
      // Just load and show installation info
      const client = await loadInstallation(config);
      console.log(`✅ Installation loaded successfully!`);
      console.log(`📋 Installation ID: ${client.installationId}`);
      console.log(`📬 Inbox ID: ${client.inboxId}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error: ${errorMessage}`);
    process.exit(1);
  }
}

void main();
