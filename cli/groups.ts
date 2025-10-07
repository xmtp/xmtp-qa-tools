import {
  IdentifierKind,
  type Conversation,
  type Group,
  type LogLevel,
  type XmtpEnv,
} from "versions/sdk";
import "dotenv/config";
import { getInboxes } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";

interface Config {
  operation: "dm" | "group" | "update";
  env: string;
  loggingLevel: LogLevel;
  // DM options
  dmCount?: number;
  // Group options
  groupName?: string;
  groupDescription?: string;
  members?: number;
  targetAddress?: string;
  // Update options
  groupId?: string;
  imageUrl?: string;
}

function showHelp() {
  console.log(`
XMTP groups - Create DMs and Groups

USAGE:
  yarn groups <operation> [options]

OPERATIONS:
  dm                      Create direct message conversations
  group                   Create a group with members
  update                  Update an existing group's metadata

OPTIONS:
  --env <environment>     XMTP environment (local, dev, production) [default: production]
  --dm-count <number>     Number of DMs to create [default: 1]
  --group-name <name>     Group name for group operations
  --group-desc <desc>     Group description
  --members <count>       Number of random members for groups [default: 5]
  --target <address>      Target address to invite to group
  --group-id <id>         Group ID for update operations (required for update)
  --name <name>           New group name for update operations
  --description <desc>    New group description for update operations
  --image-url <url>       New group image URL for update operations
  -h, --help             Show this help message

ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network (default)
  production  Production XMTP network

EXAMPLES:
  # Create 3 DMs between random users
  yarn groups dm --dm-count 3 --env dev

  # Update a group's name and description
  yarn groups update --group-id <group-id> --name "New Name" --description "New description"

  # Update only the group image
  yarn groups update --group-id <group-id> --image-url "https://example.com/image.jpg"

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
    env: process.env.XMTP_ENV ?? "production",
    loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
    dmCount: 1,
    members: 5,
  };

  // First argument is the operation
  if (args.length > 0 && !args[0].startsWith("--")) {
    const operation = args[0] as "dm" | "group" | "update";
    if (operation === "dm" || operation === "group" || operation === "update") {
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
    } else if (arg === "--group-id" && nextArg) {
      config.groupId = nextArg;
      i++;
    } else if (arg === "--name" && nextArg) {
      config.groupName = nextArg;
      i++;
    } else if (arg === "--description" && nextArg) {
      config.groupDescription = nextArg;
      i++;
    } else if (arg === "--image-url" && nextArg) {
      config.imageUrl = nextArg;
      i++;
    }
  }

  return config;
}

// Helper function to create a worker manager with specified number of workers
async function createWorkerManager(count: number, env: string) {
  return await getWorkers(count, {
    env: env as XmtpEnv,
  });
}

// Operation: Create DMs
async function runDmOperation(config: Config): Promise<void> {
  const dmCount = config.dmCount ?? 1;
  console.log(`💬 Creating ${dmCount} direct message conversations`);

  // Create users for DMs
  const userCount = Math.max(2, dmCount + 1); // Need at least 2 users for DMs

  console.log(`👥 Creating ${userCount} users...`);
  const workerManager = await createWorkerManager(userCount, config.env);
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
        const message = `Hello from user ${i + 1} to user ${j + 1}! DM created by XMTP groups CLI.`;
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
  const workerManager = await createWorkerManager(1, config.env);
  const mainWorker = workerManager.getAll()[0];
  console.log(`✅ Main worker created: ${mainWorker.inboxId}`);

  // Get existing inbox IDs for group members
  const memberInboxIds = getInboxes(members, 2).map((a) => a.inboxId);
  console.log(`📋 Using ${memberInboxIds.length} existing inbox IDs`);

  // Set up group options
  const groupName = config.groupName || `Test Group ${Date.now()}`;
  const groupDescription =
    config.groupDescription || "Group created by XMTP groups CLI";

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
    const welcomeMessage = `Welcome to ${groupName}! This group was created by the XMTP groups CLI with ${groupMembers.length} members.`;
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

// Operation: Update Group
async function runUpdateOperation(config: Config): Promise<void> {
  if (!config.groupId) {
    console.error(`❌ Error: --group-id is required for update operations`);
    console.log(
      `   Usage: yarn groups update --group-id <group-id> [--name <name>] [--description <desc>] [--image-url <url>]`,
    );
    return;
  }

  const hasUpdates =
    config.groupName || config.groupDescription || config.imageUrl;
  if (!hasUpdates) {
    console.error(
      `❌ Error: At least one update parameter is required (--name, --description, or --image-url)`,
    );
    console.log(
      `   Usage: yarn groups update --group-id <group-id> [--name <name>] [--description <desc>] [--image-url <url>]`,
    );
    return;
  }

  console.log(`🔄 Updating group: ${config.groupId}`);

  // Create a worker to perform the update
  const workerManager = await createWorkerManager(1, config.env);
  const worker = workerManager.getAll()[0];
  console.log(`✅ Worker created: ${worker.inboxId}`);

  try {
    // Get the group by ID
    const group = (await worker.client.conversations.getConversationById(
      config.groupId,
    )) as Group;

    if (!group) {
      console.error(`❌ Group not found: ${config.groupId}`);
      return;
    }

    console.log(`📋 Current group info:`);
    console.log(`   Name: ${group.name}`);
    console.log(`   Description: ${group.description || "No description"}`);
    console.log(`   Image URL: ${group.imageUrl || "No image"}`);

    // Perform updates
    const updates: string[] = [];

    if (config.groupName) {
      console.log(`✏️  Updating name to: "${config.groupName}"`);
      await group.updateName(config.groupName);
      updates.push(`name: "${config.groupName}"`);
    }

    if (config.groupDescription) {
      console.log(`✏️  Updating description to: "${config.groupDescription}"`);
      await group.updateDescription(config.groupDescription);
      updates.push(`description: "${config.groupDescription}"`);
    }

    if (config.imageUrl) {
      console.log(`✏️  Updating image URL to: "${config.imageUrl}"`);
      await group.updateImageUrl(config.imageUrl);
      updates.push(`image URL: "${config.imageUrl}"`);
    }

    console.log(`\n📊 Update Summary:`);
    console.log(`   Group ID: ${group.id}`);
    console.log(`   Updated fields: ${updates.join(", ")}`);
    console.log(`   Environment: ${config.env}`);

    console.log(`\n🎉 Group updated successfully!`);
    console.log(
      `   Group can be accessed at: https://xmtp.chat/conversations/${group.id}`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to update group: ${errorMessage}`);
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
    case "update":
      await runUpdateOperation(config);
      break;
    default:
      showHelp();
      break;
  }

  process.exit(0);
}

void main();
