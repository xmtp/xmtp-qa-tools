import { type Group, type LogLevel, type XmtpEnv } from "@workers/versions";
import "dotenv/config";
import { getWorkers } from "@workers/manager";

interface Config {
  operation: "list" | "set" | "admin" | "test" | "info";
  env: string;
  loggingLevel: LogLevel;
  groupId?: string;
  inboxId?: string;
  policy?: "default" | "admin-only" | "read-only" | "open";
  action?: "add" | "remove" | "list";
  targetAddress?: string;
}

function showHelp() {
  console.log(`
XMTP Permissions CLI - Manage group permissions and admin roles

USAGE:
  yarn permissions <operation> [options]

OPERATIONS:
  list <group-id>                    List current permissions and member roles
  set <group-id> <policy>            Set group permission policy
  admin <group-id> <inbox-id> <action>  Manage admin/super admin roles
  test <group-id>                    Test permission enforcement
  info <group-id>                    Show detailed group information

OPTIONS:
  --env <environment>     XMTP environment (local, dev, production) [default: local]
  --policy <type>         Permission policy: default, admin-only, read-only, open
  --action <action>       Admin action: add, remove, list
  --target <address>      Target address for operations
  -h, --help             Show this help message

ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network (default)
  production  Production XMTP network

PERMISSION POLICIES:
  default     - Standard group permissions (recommended)
  admin-only  - Only admins can add/remove members and update metadata
  read-only   - Only super admin can make changes
  open        - All members can add/remove members and update metadata

ADMIN ACTIONS:
  add         - Add member as admin or super admin
  remove      - Remove admin or super admin status
  list        - List all admins and super admins

EXAMPLES:
  # List permissions for a group
  yarn permissions list 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64
  
  # Set admin-only permissions
  yarn permissions set 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 admin-only
  
  # Add admin to group
  yarn permissions admin 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 0x1234... add
  
  # Test permission enforcement
  yarn permissions test 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64

ENVIRONMENT VARIABLES:
  XMTP_ENV             Default environment
  LOGGING_LEVEL        Logging level

For more information, see: cli/readme.md
`);
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    operation: "list",
    env: process.env.XMTP_ENV ?? "production",
    loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
  };

  // First argument is the operation
  if (args.length > 0 && !args[0].startsWith("--")) {
    const operation = args[0] as "list" | "set" | "admin" | "test" | "info";
    if (["list", "set", "admin", "test", "info"].includes(operation)) {
      config.operation = operation;
      args.shift(); // Remove operation from args
    }
  }

  // Second argument is group ID for most operations
  if (args.length > 0 && !args[0].startsWith("--")) {
    config.groupId = args[0];
    args.shift();
  }

  // Third argument is policy for set operation, or inbox ID for admin operation
  if (args.length > 0 && !args[0].startsWith("--")) {
    if (config.operation === "set") {
      config.policy = args[0] as
        | "default"
        | "admin-only"
        | "read-only"
        | "open";
    } else if (config.operation === "admin") {
      config.inboxId = args[0];
    }
    args.shift();
  }

  // Fourth argument is action for admin operation
  if (args.length > 0 && !args[0].startsWith("--")) {
    if (config.operation === "admin") {
      config.action = args[0] as "add" | "remove" | "list";
    }
    args.shift();
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
    } else if (arg === "--policy" && nextArg) {
      config.policy = nextArg as
        | "default"
        | "admin-only"
        | "read-only"
        | "open";
      i++;
    } else if (arg === "--action" && nextArg) {
      config.action = nextArg as "add" | "remove" | "list";
      i++;
    } else if (arg === "--target" && nextArg) {
      config.targetAddress = nextArg;
      i++;
    }
  }

  return config;
}

// Helper function to create a worker manager
async function createWorkerManager(
  count: number,
  env: string,
  loggingLevel?: LogLevel,
) {
  return await getWorkers(count, {
    env: env as XmtpEnv,
    useVersions: false, // Use latest version for permission operations
  });
}

// Helper function to get a group by ID
async function getGroupById(
  groupId: string,
  env: string,
  loggingLevel?: LogLevel,
): Promise<Group> {
  const workerManager = await createWorkerManager(1, env, loggingLevel);
  const worker = workerManager.getAll()[0];

  try {
    const conversation =
      await worker.client.conversations.getConversationById(groupId);
    if (!conversation) {
      throw new Error(`Group not found: ${groupId}`);
    }

    // Verify it's a group
    const metadata = await conversation.metadata();
    if (metadata?.conversationType !== "group") {
      throw new Error(`Conversation is not a group: ${groupId}`);
    }

    return conversation as Group;
  } catch (error) {
    throw new Error(
      `Failed to access group ${groupId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Operation: List permissions and member roles
async function runListOperation(config: Config): Promise<void> {
  if (!config.groupId) {
    console.error("❌ Group ID is required for list operation");
    process.exit(1);
  }

  console.log(`📋 Listing permissions for group: ${config.groupId}`);

  try {
    const group = await getGroupById(
      config.groupId,
      config.env,
      config.loggingLevel,
    );
    await group.sync();

    const members = await group.members();
    const admins = group.admins;
    const superAdmins = group.superAdmins;

    console.log(`\n📊 Group Information:`);
    console.log(`   Group ID: ${group.id}`);
    console.log(`   Name: ${group.name}`);
    console.log(`   Description: ${group.description || "No description"}`);
    console.log(`   Total Members: ${members.length}`);

    console.log(`\n👑 Admin Roles:`);
    console.log(`   Super Admins: ${superAdmins.length}`);
    superAdmins.forEach((admin, index) => {
      console.log(`     ${index + 1}. ${admin}`);
    });

    console.log(`   Admins: ${admins.length}`);
    admins.forEach((admin, index) => {
      console.log(`     ${index + 1}. ${admin}`);
    });

    console.log(`\n👥 All Members:`);
    members.forEach((member, index) => {
      const isSuperAdmin = superAdmins.includes(member.inboxId);
      const isAdmin = admins.includes(member.inboxId);
      const role = isSuperAdmin ? "Super Admin" : isAdmin ? "Admin" : "Member";
      console.log(`   ${index + 1}. ${member.inboxId} (${role})`);
    });

    console.log(`\n🔐 Permission Status:`);
    console.log(
      `   Note: Detailed permission policies are not yet implemented in this CLI`,
    );
    console.log(`   Current behavior: Using default XMTP group permissions`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to list permissions: ${errorMessage}`);
    process.exit(1);
  }
}

// Operation: Set permission policy
async function runSetOperation(config: Config): Promise<void> {
  if (!config.groupId || !config.policy) {
    console.error("❌ Group ID and policy are required for set operation");
    process.exit(1);
  }

  console.log(`🔧 Setting permissions for group: ${config.groupId}`);
  console.log(`📋 Policy: ${config.policy}`);

  try {
    const group = await getGroupById(
      config.groupId,
      config.env,
      config.loggingLevel,
    );
    await group.sync();

    console.log(
      `⚠️  WARNING: Permission policy setting is not yet fully implemented`,
    );
    console.log(`   Current behavior: Groups use default XMTP permissions`);
    console.log(`   Requested policy: ${config.policy}`);
    console.log(
      `   This CLI will be updated when XMTP SDK supports custom permission policies`,
    );

    // TODO: Implement actual permission policy setting when SDK supports it
    console.log(`\n✅ Permission operation completed (no-op for now)`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to set permissions: ${errorMessage}`);
    process.exit(1);
  }
}

// Operation: Manage admin roles
async function runAdminOperation(config: Config): Promise<void> {
  if (!config.groupId || !config.inboxId || !config.action) {
    console.error(
      "❌ Group ID, inbox ID, and action are required for admin operation",
    );
    process.exit(1);
  }

  console.log(`👑 Managing admin roles for group: ${config.groupId}`);
  console.log(`👤 Target inbox: ${config.inboxId}`);
  console.log(`⚡ Action: ${config.action}`);

  try {
    const group = await getGroupById(
      config.groupId,
      config.env,
      config.loggingLevel,
    );
    await group.sync();

    const isAdmin = group.isAdmin(config.inboxId);
    const isSuperAdmin = group.isSuperAdmin(config.inboxId);

    switch (config.action) {
      case "add":
        // Add as super admin (higher privilege)
        if (!isSuperAdmin) {
          await group.addSuperAdmin(config.inboxId);
          console.log(`✅ Added ${config.inboxId} as super admin`);
        } else {
          console.log(`ℹ️  ${config.inboxId} is already a super admin`);
        }
        break;

      case "remove":
        // Remove from both admin and super admin roles
        if (isSuperAdmin) {
          await group.removeSuperAdmin(config.inboxId);
          console.log(`✅ Removed super admin status from ${config.inboxId}`);
        }
        if (isAdmin) {
          await group.removeAdmin(config.inboxId);
          console.log(`✅ Removed admin status from ${config.inboxId}`);
        }
        if (!isAdmin && !isSuperAdmin) {
          console.log(`ℹ️  ${config.inboxId} is not an admin or super admin`);
        }
        break;

      case "list":
        const admins = group.admins;
        const superAdmins = group.superAdmins;

        console.log(`\n📋 Admin Roles:`);
        console.log(`   Super Admins: ${superAdmins.length}`);
        superAdmins.forEach((admin, index) => {
          console.log(`     ${index + 1}. ${admin}`);
        });

        console.log(`   Admins: ${admins.length}`);
        admins.forEach((admin, index) => {
          console.log(`     ${index + 1}. ${admin}`);
        });

        console.log(`\n👤 Target Status:`);
        console.log(
          `   ${config.inboxId}: ${isSuperAdmin ? "Super Admin" : isAdmin ? "Admin" : "Member"}`,
        );
        break;

      default:
        console.error(`❌ Unknown action: ${config.action}`);
        process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to manage admin roles: ${errorMessage}`);
    process.exit(1);
  }
}

// Operation: Test permission enforcement
async function runTestOperation(config: Config): Promise<void> {
  if (!config.groupId) {
    console.error("❌ Group ID is required for test operation");
    process.exit(1);
  }

  console.log(`🧪 Testing permission enforcement for group: ${config.groupId}`);

  try {
    const group = await getGroupById(
      config.groupId,
      config.env,
      config.loggingLevel,
    );
    await group.sync();

    const members = await group.members();
    const admins = group.admins;
    const superAdmins = group.superAdmins;

    console.log(`\n📊 Test Results:`);
    console.log(`   Group ID: ${group.id}`);
    console.log(`   Total Members: ${members.length}`);
    console.log(`   Super Admins: ${superAdmins.length}`);
    console.log(`   Admins: ${admins.length}`);

    // Test basic permission checks
    console.log(`\n🔍 Permission Tests:`);

    if (members.length > 0) {
      const testMember = members[0];
      console.log(`   Test Member: ${testMember.inboxId}`);
      console.log(`   Is Admin: ${group.isAdmin(testMember.inboxId)}`);
      console.log(
        `   Is Super Admin: ${group.isSuperAdmin(testMember.inboxId)}`,
      );
    }

    if (superAdmins.length > 0) {
      const testSuperAdmin = superAdmins[0];
      console.log(`   Test Super Admin: ${testSuperAdmin}`);
      console.log(`   Is Admin: ${group.isAdmin(testSuperAdmin)}`);
      console.log(`   Is Super Admin: ${group.isSuperAdmin(testSuperAdmin)}`);
    }

    console.log(`\n✅ Permission test completed`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to test permissions: ${errorMessage}`);
    process.exit(1);
  }
}

// Operation: Show detailed group information
async function runInfoOperation(config: Config): Promise<void> {
  if (!config.groupId) {
    console.error("❌ Group ID is required for info operation");
    process.exit(1);
  }

  console.log(`ℹ️  Getting detailed information for group: ${config.groupId}`);

  try {
    const group = await getGroupById(
      config.groupId,
      config.env,
      config.loggingLevel,
    );
    await group.sync();

    const members = await group.members();
    const admins = group.admins;
    const superAdmins = group.superAdmins;

    console.log(`\n📋 Group Details:`);
    console.log(`   ID: ${group.id}`);
    console.log(`   Name: ${group.name}`);
    console.log(`   Description: ${group.description || "No description"}`);
    console.log(`   Image URL: ${group.imageUrl || "No image"}`);

    console.log(`\n👥 Member Statistics:`);
    console.log(`   Total Members: ${members.length}`);
    console.log(`   Super Admins: ${superAdmins.length}`);
    console.log(`   Admins: ${admins.length}`);
    console.log(
      `   Regular Members: ${members.length - admins.length - superAdmins.length}`,
    );

    console.log(`\n🔗 Group URL:`);
    console.log(`   https://xmtp.chat/conversations/${group.id}`);

    console.log(`\n📝 Note: This CLI provides basic group information.`);
    console.log(
      `   For advanced permission management, use the XMTP SDK directly.`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to get group info: ${errorMessage}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const config = parseArgs();

  switch (config.operation) {
    case "list":
      await runListOperation(config);
      break;
    case "set":
      await runSetOperation(config);
      break;
    case "admin":
      await runAdminOperation(config);
      break;
    case "test":
      await runTestOperation(config);
      break;
    case "info":
      await runInfoOperation(config);
      break;
    default:
      showHelp();
      break;
  }

  process.exit(0);
}

void main();
