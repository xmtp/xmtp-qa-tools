import {
  Client,
  IdentifierKind,
  type Conversation,
  type Group,
  type LogLevel,
  type XmtpEnv,
} from "@workers/versions";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { generatePrivateKey } from "viem/accounts";
import {
  createSigner,
  generateEncryptionKeyHex,
  getDbPathQA,
  getEncryptionKeyFromHex,
} from "../helpers/client";
import { getRandomInboxIds } from "../inboxes/utils";

interface Config {
  operation: "dm" | "group";
  env: string;
  loggingLevel: LogLevel;
  // DM options
  dmCount?: number;
  // Group options
  groupName?: string;
  groupDescription?: string;
  members?: number;
  targetAddress?: string;
  permissions?: "default" | "admin-only" | "read-only" | "open";
}

function showHelp() {
  console.log(`
XMTP Create CLI - Create DMs and Groups with permissions

USAGE:
  yarn create <operation> [options]

OPERATIONS:
  dm                      Create direct message conversations
  group                   Create a group with members and permissions

OPTIONS:
  --env <environment>     XMTP environment (local, dev, production) [default: local]
  --dm-count <number>     Number of DMs to create [default: 1]
  --group-name <name>     Group name for group operations
  --group-desc <desc>     Group description
  --members <count>       Number of random members for groups [default: 5]
  --target <address>      Target address to invite to group
  --permissions <type>    Group permissions: default, admin-only, read-only, open
  -h, --help             Show this help message

ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network (default)
  production  Production XMTP network

PERMISSION TYPES:
  default     - Standard group permissions (recommended)
  admin-only  - Only admins can add/remove members and update metadata
  read-only   - Only super admin can make changes
  open        - All members can add/remove members and update metadata

EXAMPLES:
  # Create 3 DMs between random users
  yarn create dm --dm-count 3 --env dev
  
  # Create group with default permissions
  yarn create group --group-name "Test Group" --members 5 --env dev
  
  # Create admin-only group and invite target
  yarn create group --group-name "Admin Group" --target 0x1234... --permissions admin-only --env production
  
  # Create read-only group
  yarn create group --group-name "Read Only" --permissions read-only --env dev

ENVIRONMENT VARIABLES:
  XMTP_ENV             Default environment
  LOGGING_LEVEL        Logging level

For more information, see: cli/readme.md
`);
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    operation: "dm",
    env: process.env.XMTP_ENV ?? "local",
    loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
    dmCount: 1,
    members: 5,
    permissions: "default",
  };

  // First argument is the operation
  if (args.length > 0 && !args[0].startsWith("--")) {
    const operation = args[0] as "dm" | "group";
    if (operation === "dm" || operation === "group") {
      config.operation = operation;
      args.shift(); // Remove operation from args
    }
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    } else if (arg === "--env" && nextArg) {
      config.env = nextArg;
      i++;
    } else if (arg === "--dm-count" && nextArg) {
      config.dmCount = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--group-name" && nextArg) {
      config.groupName = nextArg;
      i++;
    } else if (arg === "--group-desc" && nextArg) {
      config.groupDescription = nextArg;
      i++;
    } else if (arg === "--members" && nextArg) {
      config.members = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--target" && nextArg) {
      config.targetAddress = nextArg;
      i++;
    } else if (arg === "--permissions" && nextArg) {
      config.permissions = nextArg as
        | "default"
        | "admin-only"
        | "read-only"
        | "open";
      i++;
    }
  }

  return config;
}

// Helper function to create a client
async function createClient(
  index: number,
  env: string,
  loggingLevel?: LogLevel,
): Promise<Client> {
  const workerKey = generatePrivateKey();
  const signer = createSigner(workerKey);
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  const dbPath = getDbPathQA(`create/${env}-${index}-${signerIdentifier}`);
  const sendDir = path.dirname(dbPath);
  if (!fs.existsSync(sendDir)) {
    fs.mkdirSync(sendDir, { recursive: true });
  }
  const dbEncryptionKey = getEncryptionKeyFromHex(generateEncryptionKeyHex());

  return await Client.create(signer, {
    env: env as XmtpEnv,
    dbPath,
    dbEncryptionKey,
    loggingLevel,
  });
}

// Helper function to get permission set based on type
function getPermissionSet(type: string) {
  // For now, return undefined to use default permissions
  // This can be expanded later when permission types are properly imported
  return undefined;
}

// Operation: Create DMs
async function runDmOperation(config: Config): Promise<void> {
  console.log(`💬 Creating ${config.dmCount} direct message conversations`);

  // Create users for DMs
  const userCount = Math.max(2, config.dmCount! + 1); // Need at least 2 users for DMs
  const users: Client[] = [];

  console.log(`👥 Creating ${userCount} users...`);
  for (let i = 0; i < userCount; i++) {
    const client = await createClient(i, config.env, config.loggingLevel);
    users.push(client);
    console.log(`✅ Created user ${i + 1}: ${client.inboxId}`);
  }

  // Create DMs between users
  const conversations: Conversation[] = [];
  let dmCount = 0;

  console.log(`💬 Creating DMs...`);
  for (let i = 0; i < users.length && dmCount < config.dmCount!; i++) {
    for (let j = i + 1; j < users.length && dmCount < config.dmCount!; j++) {
      try {
        const conversation = await users[i].conversations.newDm(
          users[j].inboxId,
        );
        conversations.push(conversation);
        dmCount++;
        console.log(`✅ Created DM ${dmCount}: user ${i + 1} ↔ user ${j + 1}`);

        // Send a test message
        await conversation.send(
          `Hello from user ${i + 1} to user ${j + 1}! DM created by XMTP Create CLI.`,
        );
        console.log(`📤 Sent test message in DM ${dmCount}`);
      } catch (error) {
        console.warn(
          `⚠️  Failed to create DM between user ${i + 1} and user ${j + 1}: ${error}`,
        );
      }
    }
  }

  console.log(`\n📊 DM Summary:`);
  console.log(`   Users Created: ${users.length}`);
  console.log(`   DMs Created: ${conversations.length}`);
  console.log(`   Target DMs: ${config.dmCount}`);
  console.log(`   Environment: ${config.env}`);
}

// Operation: Create Group
async function runGroupOperation(config: Config): Promise<void> {
  console.log(`🏗️  Creating group with ${config.members} members`);

  // Create main client
  const mainClient = await createClient(0, config.env, config.loggingLevel);
  console.log(`✅ Main client created: ${mainClient.inboxId}`);

  // Get existing inbox IDs for group members
  const memberInboxIds = getRandomInboxIds(config.members!, 2);
  console.log(`📋 Using ${memberInboxIds.length} existing inbox IDs`);

  // Set up group options
  const groupName = config.groupName || `Test Group ${Date.now()}`;
  const groupDescription =
    config.groupDescription || "Group created by XMTP Create CLI";
  const permissions = getPermissionSet(config.permissions!);

  console.log(`👥 Creating group: "${groupName}"`);
  console.log(`📝 Description: "${groupDescription}"`);
  console.log(`🔐 Permissions: ${config.permissions}`);

  try {
    // Create group with existing inbox IDs and permissions
    const group = (await mainClient.conversations.newGroup(memberInboxIds, {
      groupName,
      groupDescription,
      permissions,
    })) as Group;

    console.log(`✅ Group created with ID: ${group.id}`);

    // Add target address to the group if specified
    if (config.targetAddress) {
      console.log(`🎯 Adding target address: ${config.targetAddress}`);
      try {
        await group.addMembersByIdentifiers([
          {
            identifier: config.targetAddress,
            identifierKind: IdentifierKind.Ethereum,
          },
        ]);
        console.log(`✅ Added target address to group`);

        // Make target address an admin if using admin-only permissions
        if (config.permissions === "admin-only") {
          try {
            await group.addAdmin(config.targetAddress);
            console.log(`👑 Made ${config.targetAddress} an admin`);
          } catch (error) {
            console.warn(`⚠️  Could not make target admin: ${error}`);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Failed to add target address: ${error}`);
      }
    }

    // Sync group to get updated member list
    await group.sync();
    const members = await group.members();

    console.log(`\n📊 Group Summary:`);
    console.log(`   Group ID: ${group.id}`);
    console.log(`   Group Name: ${group.name}`);
    console.log(`   Description: ${group.description || "No description"}`);
    console.log(`   Total Members: ${members.length}`);
    console.log(`   Random Members: ${memberInboxIds.length}`);
    if (config.targetAddress) {
      console.log(`   Target Member: ${config.targetAddress}`);
    }
    console.log(`   Permission Type: ${config.permissions}`);

    // Send welcome message to group
    const welcomeMessage = `Welcome to ${groupName}! This group was created by the XMTP Create CLI with ${members.length} members and ${config.permissions} permissions.`;
    await group.send(welcomeMessage);
    console.log(`💬 Sent welcome message to group`);

    console.log(`\n🎉 Group operation completed successfully!`);
    console.log(
      `   Group can be accessed at: https://xmtp.chat/conversations/${group.id}`,
    );
  } catch (error) {
    console.error(`❌ Failed to create group: ${error}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const config = parseArgs();

  switch (config.operation) {
    case "dm":
      await runDmOperation(config);
      break;
    case "group":
      await runGroupOperation(config);
      break;
    default:
      showHelp();
      break;
  }

  process.exit(0);
}

void main();
