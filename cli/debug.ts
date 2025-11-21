#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  IdentifierKind,
  type XmtpEnv,
} from "@helpers/versions";
import {
  APP_VERSION,
  createSigner,
  generateEncryptionKeyHex,
  getEncryptionKeyFromHex,
} from "@helpers/client";
import { Client } from "@helpers/versions";

function showHelp() {
  console.log(`
XMTP Debug CLI - Get DM conversation ID by address or inbox ID

USAGE:
  yarn debug [options]

OPTIONS:
  --address <address>         Ethereum address to get/create DM for
  --inbox-id <inbox-id>       Inbox ID to get/create DM for
  --list-conversations        List all conversations with message counts and last messages
  --env <environment>         XMTP environment (local, dev, production) [default: dev]
  -h, --help                  Show this help message

ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network (default)
  production  Production XMTP network

DESCRIPTION:
  Gets or creates a DM conversation and prints its conversation ID, or lists
  all conversations with statistics.
  
  Can work with either an Ethereum address or an inbox ID to get a specific DM,
  or use --list-conversations to see all conversations with message counts and
  last messages.
  
  This command reads wallet keys from a .env file in the current directory.
  If no .env file exists, it will create one with new keys.

EXAMPLES:
  # Get DM by Ethereum address
  yarn debug --address 0x1234567890123456789012345678901234567890

  # Get DM by inbox ID
  yarn debug --inbox-id 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64

  # List all conversations with stats
  yarn debug --list-conversations

  # With specific environment
  yarn debug --address 0x1234... --env production
  yarn debug --list-conversations --env production

  # Show help
  yarn debug --help

For more information, see: cli/readme.md
`);
}

interface Config {
  address?: string;
  inboxId?: string;
  listConversations?: boolean;
  env: XmtpEnv;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    env: "dev",
    listConversations: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    } else if (arg === "--address" && nextArg) {
      config.address = nextArg;
      i++;
    } else if (arg === "--inbox-id" && nextArg) {
      config.inboxId = nextArg;
      i++;
    } else if (arg === "--list-conversations") {
      config.listConversations = true;
    } else if (arg === "--env" && nextArg) {
      config.env = nextArg as XmtpEnv;
      i++;
    }
  }

  return config;
}

async function getDmByAddress(
  client: Client,
  address: string,
): Promise<string> {
  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(
      `Invalid Ethereum address format. Must be 42 characters starting with 0x.`,
    );
  }

  console.log(`Getting DM for address: ${address}`);

  // Create or get DM conversation
  const dm = await client.conversations.newDmWithIdentifier({
    identifier: address as `0x${string}`,
    identifierKind: IdentifierKind.Ethereum,
  });

  return dm.id;
}

async function getDmByInboxId(
  client: Client,
  inboxId: string,
): Promise<string> {
  // Validate inbox ID format (should be 64 hex characters)
  if (!/^[a-f0-9]{64}$/i.test(inboxId)) {
    throw new Error(
      `Invalid inbox ID format. Must be 64 hexadecimal characters.`,
    );
  }

  console.log(`Getting DM for inbox ID: ${inboxId}`);

  // Create or get DM conversation
  const dm = await client.conversations.newDm(inboxId);

  return dm.id;
}

interface ConversationStats {
  id: string;
  type: "DM" | "Group";
  messageCount: number;
  lastMessage?: {
    content: string;
    sentAt: Date;
    senderInboxId: string;
  };
}

async function listAllConversations(client: Client): Promise<void> {
  console.log(`Syncing conversations...`);
  
  // Sync conversations first
  await client.conversations.sync();
  
  // Get all conversations
  const conversations = await client.conversations.list();
  
  // Total conversation count
  const totalCount = conversations.length;
  const dms = conversations.filter((conv) => {
    // Check if it's a DM (has peerInboxId property)
    return "peerInboxId" in conv;
  });
  const groups = conversations.filter((conv) => {
    // Check if it's a Group (has name property)
    return "name" in conv;
  });
  
  console.log(`\n📊 Conversation Statistics:`);
  console.log(`   Total Conversations: ${totalCount}`);
  console.log(`   DMs: ${dms.length}`);
  console.log(`   Groups: ${groups.length}`);
  
  if (totalCount === 0) {
    console.log(`\n✓ No conversations found.`);
    return;
  }
  
  console.log(`\n📋 Conversations Details:\n`);
  
  const conversationStats: ConversationStats[] = [];
  
  // Process each conversation
  for (const conv of conversations) {
    try {
      // Get messages for this conversation
      const messages = await conv.messages();
      const messageCount = messages.length;
      
      // Get last message if exists
      let lastMessage: ConversationStats["lastMessage"] | undefined;
      if (messages.length > 0) {
        const last = messages[0]; // Messages are typically in reverse chronological order
        lastMessage = {
          content:
            typeof last.content === "string"
              ? last.content.substring(0, 100) // Truncate long messages
              : JSON.stringify(last.content).substring(0, 100),
          sentAt: last.sentAt,
          senderInboxId: last.senderInboxId,
        };
      }
      
      // Determine type
      const type = "peerInboxId" in conv ? "DM" : "Group";
      
      conversationStats.push({
        id: conv.id,
        type,
        messageCount,
        lastMessage,
      });
    } catch (error) {
      // If we can't get messages for a conversation, still include it with 0 count
      const type = "peerInboxId" in conv ? "DM" : "Group";
      conversationStats.push({
        id: conv.id,
        type,
        messageCount: 0,
      });
      console.warn(`⚠️  Warning: Could not get messages for conversation ${conv.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Sort by last message time (most recent first), then by message count
  conversationStats.sort((a, b) => {
    if (a.lastMessage && b.lastMessage) {
      return b.lastMessage.sentAt.getTime() - a.lastMessage.sentAt.getTime();
    }
    if (a.lastMessage) return -1;
    if (b.lastMessage) return 1;
    return b.messageCount - a.messageCount;
  });
  
  // Print formatted table
  console.log(
    `${"Type".padEnd(8)} ${"Messages".padEnd(10)} ${"Last Message".padEnd(50)} ${"Conversation ID"}`,
  );
  console.log("─".repeat(120));
  
  for (const stat of conversationStats) {
    const type = stat.type.padEnd(8);
    const messageCount = stat.messageCount.toString().padEnd(10);
    
    let lastMessageInfo = "No messages";
    if (stat.lastMessage) {
      const timeAgo = Math.floor(
        (Date.now() - stat.lastMessage.sentAt.getTime()) / 1000 / 60,
      ); // minutes ago
      const timeStr =
        timeAgo < 60
          ? `${timeAgo}m ago`
          : timeAgo < 1440
            ? `${Math.floor(timeAgo / 60)}h ago`
            : `${Math.floor(timeAgo / 1440)}d ago`;
      const contentPreview = stat.lastMessage.content.replace(/\n/g, " ").substring(0, 40);
      lastMessageInfo = `${timeStr}: ${contentPreview}${stat.lastMessage.content.length > 40 ? "..." : ""}`;
    }
    lastMessageInfo = lastMessageInfo.padEnd(50);
    
    const conversationId = stat.id.substring(0, 16) + "...";
    
    console.log(`${type} ${messageCount} ${lastMessageInfo} ${conversationId}`);
  }
  
  console.log("─".repeat(120));
  console.log(`\n🔗 View conversations at: https://xmtp.chat/conversations`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  // Check Node.js version
  const nodeVersion = process.versions.node;
  const [major] = nodeVersion.split(".").map(Number);
  if (major < 20) {
    console.error("Error: Node.js version 20 or higher is required");
    process.exit(1);
  }

  const config = parseArgs();

  // If listing conversations, we don't need address/inbox-id
  if (config.listConversations) {
    // Allow listing conversations without address/inbox-id
  } else {
    // Validate that either address or inbox-id is provided
    if (!config.address && !config.inboxId) {
      console.error("Error: Either --address, --inbox-id, or --list-conversations is required");
      console.error("Usage: yarn debug --address <address> OR yarn debug --inbox-id <inbox-id> OR yarn debug --list-conversations");
      console.error("Run 'yarn debug --help' for more information");
      process.exit(1);
    }
  }

  // Validate that both address and inbox-id are not provided
  if (config.address && config.inboxId) {
    console.error("Error: Cannot use both --address and --inbox-id. Choose one.");
    console.error("Usage: yarn debug --address <address> OR yarn debug --inbox-id <inbox-id>");
    process.exit(1);
  }

  // Validate that list-conversations is not used with address/inbox-id
  if (config.listConversations && (config.address || config.inboxId)) {
    console.error("Error: Cannot use --list-conversations with --address or --inbox-id.");
    console.error("Usage: yarn debug --list-conversations (standalone)");
    process.exit(1);
  }

  // Get the current working directory
  const exampleDir = process.cwd();
  const envPath = join(exampleDir, ".env");

  console.log(`Looking for .env file in: ${exampleDir}`);

  let walletKey: string;
  let encryptionKeyHex: string;
  let env: XmtpEnv = config.env;

  // Check if .env file exists
  if (existsSync(envPath)) {
    // Sanitize environment variable value by removing surrounding quotes
    const sanitizeEnvValue = (value: string): string => {
      const trimmed = value.trim();
      // Remove surrounding quotes (single or double) if present
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    };

    // Read and parse .env file
    const envContent = await readFile(envPath, "utf-8");
    const envVars: Record<string, string> = {};

    envContent.split("\n").forEach((line) => {
      const [key, value] = line.split("=");
      if (key && value && !key.startsWith("#")) {
        envVars[key.trim()] = sanitizeEnvValue(value);
      }
    });

    // Use environment from .env file if available, otherwise use config
    env = (envVars.XMTP_ENV as XmtpEnv) || config.env;
    walletKey = envVars.XMTP_WALLET_KEY;
    encryptionKeyHex = envVars.XMTP_DB_ENCRYPTION_KEY;

    if (!walletKey || !encryptionKeyHex) {
      console.error(
        "Error: Missing XMTP_WALLET_KEY or XMTP_DB_ENCRYPTION_KEY in .env file.",
      );
      console.error("Please run 'yarn gen:keys' first to generate keys.");
      process.exit(1);
    }
  } else {
    // No .env file exists, generate new keys
    console.log("No .env file found. Generating new keys...");
    const { generatePrivateKey } = await import("viem/accounts");
    walletKey = generatePrivateKey();
    encryptionKeyHex = generateEncryptionKeyHex();
    console.log("Generated new keys. Consider running 'yarn gen:keys' to save them to .env");
  }

  try {
    // Create signer and client
    const signer = createSigner(walletKey);
    const dbEncryptionKey = getEncryptionKeyFromHex(encryptionKeyHex);

    console.log(`Creating client for environment: ${env}`);

    const client = await Client.create(signer, {
      dbEncryptionKey,
      dbPath: null, // Use in-memory database for debug
      appVersion: APP_VERSION,
      env,
    });

    console.log(`✓ Client created (inbox ID: ${client.inboxId})`);

    // List conversations if requested
    if (config.listConversations) {
      await listAllConversations(client);
      process.exit(0);
    }

    // Get DM conversation ID
    let dmId: string;

    if (config.address) {
      dmId = await getDmByAddress(client, config.address);
    } else if (config.inboxId) {
      dmId = await getDmByInboxId(client, config.inboxId);
    } else {
      throw new Error("Either address or inbox-id must be provided");
    }

    // Print the DM conversation ID
    console.log(`\n✓ DM Conversation ID: ${dmId}`);
    console.log(`\n🔗 DM URL: https://xmtp.chat/conversations/${dmId}`);

    process.exit(0);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error getting DM:", errorMessage);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});

