import {
  IdentifierKind,
  type Conversation,
  type Group,
  type LogLevel,
  type XmtpEnv,
} from "@workers/versions";
import "dotenv/config";
import { getRandomInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";

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
}

function showHelp() {
  console.log(`
XMTP Create CLI - Create DMs and Groups

USAGE:
  yarn groups <operation> [options]

OPERATIONS:
  dm                      Create direct message conversations
  group                   Create a group with members

OPTIONS:
  --env <environment>     XMTP environment (local, dev, production) [default: local]
  --dm-count <number>     Number of DMs to create [default: 1]
  --group-name <name>     Group name for group operations
  --group-desc <desc>     Group description
  --members <count>       Number of random members for groups [default: 5]
  --target <address>      Target address to invite to group
  -h, --help             Show this help message

ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network (default)
  production  Production XMTP network

EXAMPLES:
  # Create 3 DMs between random users
  yarn groups dm --dm-count 3 --env dev

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
    }
  }

  return config;
}

// Helper function to create a worker manager with specified number of workers
async function createWorkerManager(
  count: number,
  env: string,
  loggingLevel?: LogLevel,
) {
  return await getWorkers(count, {
    env: env as XmtpEnv,
    useVersions: false, // Use latest version for group operations
  });
}

// Operation: Create DMs
async function runDmOperation(config: Config): Promise<void> {
  const dmCount = config.dmCount ?? 1;
  console.log(`💬 Creating ${dmCount} direct message conversations`);

  // Create users for DMs
  const userCount = Math.max(2, dmCount + 1); // Need at least 2 users for DMs

  console.log(`👥 Creating ${userCount} users...`);
  const workerManager = await createWorkerManager(
    userCount,
    config.env,
    config.loggingLevel,
  );
  const workers = workerManager.getAll();

  for (let i = 0; i < workers.length; i++) {
    console.log(`✅ Created user ${i + 1}: ${workers[i].inboxId}`);
  }

  // Create DMs between workers
  const conversations: Conversation[] = [];
  let createdDmCount = 0;

  console.log(`💬 Creating DMs...`);
  for (let i = 0; i < workers.length && createdDmCount < dmCount; i++) {
    for (let j = i + 1; j < workers.length && createdDmCount < dmCount; j++) {
      try {
        const conversation = await workers[i].client.conversations.newDm(
          workers[j].inboxId,
        );
        conversations.push(conversation);
        createdDmCount++;
        console.log(
          `✅ Created DM ${createdDmCount}: user ${i + 1} ↔ user ${j + 1}`,
        );

        // Send a test message
        const message = `Hello from user ${i + 1} to user ${j + 1}! DM created by XMTP Create CLI.`;
        await conversation.send(message);
        console.log(`📤 Sent test message in DM ${createdDmCount}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `⚠️  Failed to create DM between user ${i + 1} and user ${j + 1}: ${errorMessage}`,
        );
      }
    }
  }

  console.log(`\n📊 DM Summary:`);
  console.log(`   Users Created: ${workers.length}`);
  console.log(`   DMs Created: ${conversations.length}`);
  console.log(`   Target DMs: ${dmCount}`);
  console.log(`   Environment: ${config.env}`);
}

// Operation: Create Group
async function runGroupOperation(config: Config): Promise<void> {
  const members = config.members ?? 5;
  console.log(`🏗️  Creating group with ${members} members`);

  // Create main worker
  const workerManager = await createWorkerManager(
    1,
    config.env,
    config.loggingLevel,
  );
  const mainWorker = workerManager.getAll()[0];
  console.log(`✅ Main worker created: ${mainWorker.inboxId}`);

  // Get existing inbox IDs for group members
  const memberInboxIds = getRandomInboxIds(members, 2);
  console.log(`📋 Using ${memberInboxIds.length} existing inbox IDs`);

  // Set up group options
  const groupName = config.groupName || `Test Group ${Date.now()}`;
  const groupDescription =
    config.groupDescription || "Group created by XMTP Create CLI";

  console.log(`👥 Creating group: "${groupName}"`);
  console.log(`📝 Description: "${groupDescription}"`);

  try {
    // Create group with existing inbox IDs
    const group = (await mainWorker.client.conversations.newGroup(
      memberInboxIds,
      {
        groupName,
        groupDescription,
      },
    )) as Group;

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
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warn(`⚠️  Failed to add target address: ${errorMessage}`);
      }
    }

    // Sync group to get updated member list
    await group.sync();
    const groupMembers = await group.members();

    console.log(`\n📊 Group Summary:`);
    console.log(`   Group ID: ${group.id}`);
    console.log(`   Group Name: ${group.name}`);
    console.log(`   Description: ${group.description || "No description"}`);
    console.log(`   Total Members: ${groupMembers.length}`);
    console.log(`   Random Members: ${memberInboxIds.length}`);
    if (config.targetAddress) {
      console.log(`   Target Member: ${config.targetAddress}`);
    }

    // Send welcome message to group
    const welcomeMessage = `Welcome to ${groupName}! This group was created by the XMTP Create CLI with ${groupMembers.length} members.`;
    await group.send(welcomeMessage);
    console.log(`💬 Sent welcome message to group`);

    console.log(`\n🎉 Group operation completed successfully!`);
    console.log(
      `   Group can be accessed at: https://xmtp.chat/conversations/${group.id}`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to create group: ${errorMessage}`);
    return;
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
