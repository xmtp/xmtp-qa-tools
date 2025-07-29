import {
  type Client,
  type Group,
  type LogLevel,
  type PermissionUpdateType,
  type XmtpEnv,
} from "@workers/versions";
import "dotenv/config";
import { getWorkers } from "@workers/manager";

interface Config {
  operation: "list" | "info" | "update-permissions";
  env: string;
  loggingLevel: LogLevel;
  groupId?: string;
  inboxId?: string;
  targetAddress?: string;
  features?: string[];
  permissions?: string;
}

// Available features that can be configured
const AVAILABLE_FEATURES = [
  "add-member",
  "remove-member",
  "add-admin",
  "remove-admin",
  "add-super-admin",
  "remove-super-admin",
  "update-metadata",
  "update-permissions",
];

// Available permission types
const AVAILABLE_PERMISSIONS = [
  "everyone",
  "disabled",
  "admin-only",
  "super-admin-only",
];

// Permission types mapping to SDK enum values
const PERMISSION_TYPES = {
  "add-member": 1, // AddMember
  "remove-member": 2, // RemoveMember
  "add-admin": 3, // AddAdmin
  "remove-admin": 5, // RemoveAdmin
  "add-super-admin": 6, // AddSuperAdmin
  "remove-super-admin": 7, // RemoveSuperAdmin
  "update-metadata": 4, // UpdateMetadata
  "update-permissions": 8, // UpdatePermissions
} as const;

// Permission policy mapping
const PERMISSION_POLICIES = {
  everyone: 0, // Everyone
  disabled: 1, // Disabled
  "admin-only": 2, // AdminOnly
  "super-admin-only": 3, // SuperAdminOnly
} as const;

function showHelp() {
  console.log(`
XMTP Group Permissions CLI - Flexible permission management

USAGE:
  yarn permissions <operation> <group-id> [options]

OPERATIONS:
  list <group-id>                           List all members and their roles
  info <group-id>                           Show detailed group information
  update-permissions <group-id>              Update feature permissions

OPTIONS:
  --features <feature-list>                 Comma-separated features to update
  --permissions <permission-type>           Permission type to apply
  --env <environment>                       XMTP environment (local, dev, production) [default: production]
  --target <address>                        Target address for operations
  -h, --help                               Show this help message

AVAILABLE FEATURES:
  add-member                                Adding new members to group
  remove-member                             Removing members from group
  add-admin                                 Promoting members to admin
  remove-admin                              Demoting admins to member
  add-super-admin                          Promoting to super admin
  remove-super-admin                       Demoting super admins
  update-metadata                          Updating group metadata
  update-permissions                       Changing permission policies

AVAILABLE PERMISSIONS:
  everyone                                  All group members can perform action
  disabled                                  Feature is completely disabled
  admin-only                                Only admins and super admins can perform action
  super-admin-only                         Only super admins can perform action

ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network (default)
  production  Production XMTP network

EXAMPLES:
  # List all members and their roles
  yarn permissions list 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64
  
  # Update metadata permissions to admin-only
  yarn permissions update-permissions 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 --features update-metadata --permissions admin-only
  
  # Update multiple features at once
  yarn permissions update-permissions 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 --features add-member,remove-member,update-metadata --permissions admin-only
  
  # Disable a feature completely
  yarn permissions update-permissions 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 --features update-metadata --permissions disabled
  
  # Show detailed group info
  yarn permissions info 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64

ENVIRONMENT VARIABLES:
  XMTP_ENV             Default environment
  LOGGING_LEVEL        Logging level

For more information, see: https://docs.xmtp.org/inboxes/group-permissions
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
    const operation = args[0] as Config["operation"];
    if (["list", "info", "update-permissions"].includes(operation)) {
      config.operation = operation;
      args.shift(); // Remove operation from args
    }
  }

  // Second argument is group ID for all operations
  if (args.length > 0 && !args[0].startsWith("--")) {
    config.groupId = args[0];
    args.shift();
  }

  // Parse remaining options
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    } else if (arg === "--env" && nextArg) {
      config.env = nextArg;
      i++;
    } else if (arg === "--target" && nextArg) {
      config.targetAddress = nextArg;
      i++;
    } else if (arg === "--features" && nextArg) {
      config.features = nextArg.split(",").map((f) => f.trim());
      i++;
    } else if (arg === "--permissions" && nextArg) {
      config.permissions = nextArg;
      i++;
    }
  }

  return config;
}

// Helper function to create a worker manager and get client
async function getClient(env: string): Promise<Client> {
  const workerManager = await getWorkers(1, {
    env: env as XmtpEnv,
    useVersions: false, // Use latest version for permission operations
  });
  const worker = workerManager.getAll()[0];
  return worker.client;
}

// Helper function to get a group by ID using SDK
async function getGroupById(groupId: string, env: string): Promise<Group> {
  const client = await getClient(env);

  try {
    const conversation =
      await client.conversations.getConversationById(groupId);
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

// Operation: List all members and their roles
async function runListOperation(config: Config): Promise<void> {
  if (!config.groupId) {
    console.error("❌ Group ID is required for list operation");
    process.exit(1);
  }

  console.log(`📋 Listing members for group: ${config.groupId}`);

  try {
    const group = await getGroupById(config.groupId, config.env);
    await group.sync();

    const members = await group.members();
    const admins = group.admins;
    const superAdmins = group.superAdmins;

    console.log(`\n📊 Group Information:`);
    console.log(`   Group ID: ${group.id}`);
    console.log(`   Name: ${group.name || "Unnamed Group"}`);
    console.log(`   Description: ${group.description || "No description"}`);
    console.log(`   Total Members: ${members.length}`);

    console.log(`\n👑 Admin Roles:`);
    console.log(`   Super Admins: ${superAdmins.length}`);
    if (superAdmins.length > 0) {
      superAdmins.forEach((admin, index) => {
        console.log(`     ${index + 1}. ${admin}`);
      });
    } else {
      console.log(`     None`);
    }

    console.log(`   Admins: ${admins.length}`);
    if (admins.length > 0) {
      admins.forEach((admin, index) => {
        console.log(`     ${index + 1}. ${admin}`);
      });
    } else {
      console.log(`     None`);
    }

    console.log(`\n👥 All Members:`);
    members.forEach((member, index) => {
      const isSuperAdmin = superAdmins.includes(member.inboxId);
      const isAdmin = admins.includes(member.inboxId);
      const role = isSuperAdmin ? "Super Admin" : isAdmin ? "Admin" : "Member";
      console.log(`   ${index + 1}. ${member.inboxId} (${role})`);
    });

    console.log(`\n🔐 Current XMTP Permissions:`);
    console.log(`   • Add member: All members`);
    console.log(`   • Remove member: Admin only`);
    console.log(`   • Add admin: Super admin only`);
    console.log(`   • Remove admin: Super admin only`);
    console.log(`   • Update group permissions: Super admin only`);
    console.log(`   • Update group metadata: All members`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to list members: ${errorMessage}`);
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
    const group = await getGroupById(config.groupId, config.env);
    await group.sync();

    const members = await group.members();
    const admins = group.admins;
    const superAdmins = group.superAdmins;

    console.log(`\n📋 Group Details:`);
    console.log(`   ID: ${group.id}`);
    console.log(`   Name: ${group.name || "Unnamed Group"}`);
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

    console.log(`\n🔐 XMTP Default Permissions:`);
    console.log(`   • Add member: All members`);
    console.log(`   • Remove member: Admin only`);
    console.log(`   • Add admin: Super admin only`);
    console.log(`   • Remove admin: Super admin only`);
    console.log(`   • Update group permissions: Super admin only`);
    console.log(`   • Update group metadata: All members`);

    console.log(`\n📝 Note: This CLI provides basic group management.`);
    console.log(`   For advanced features, use the XMTP SDK directly.`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to get group info: ${errorMessage}`);
    process.exit(1);
  }
}

// Operation: Update permissions for specified features
async function runUpdatePermissionsOperation(config: Config): Promise<void> {
  if (!config.groupId) {
    console.error("❌ Group ID is required for update-permissions operation");
    process.exit(1);
  }

  if (!config.features || config.features.length === 0) {
    console.error("❌ --features is required for update-permissions operation");
    console.error("   Available features:", AVAILABLE_FEATURES.join(", "));
    process.exit(1);
  }

  if (!config.permissions) {
    console.error(
      "❌ --permissions is required for update-permissions operation",
    );
    console.error(
      "   Available permissions:",
      AVAILABLE_PERMISSIONS.join(", "),
    );
    process.exit(1);
  }

  // Validate features
  const invalidFeatures = config.features.filter(
    (f) => !AVAILABLE_FEATURES.includes(f),
  );
  if (invalidFeatures.length > 0) {
    console.error("❌ Invalid features:", invalidFeatures.join(", "));
    console.error("   Available features:", AVAILABLE_FEATURES.join(", "));
    process.exit(1);
  }

  // Validate permissions
  if (!AVAILABLE_PERMISSIONS.includes(config.permissions)) {
    console.error("❌ Invalid permission type:", config.permissions);
    console.error(
      "   Available permissions:",
      AVAILABLE_PERMISSIONS.join(", "),
    );
    process.exit(1);
  }

  console.log(`🔐 Updating permissions for group: ${config.groupId}`);
  console.log(`📋 Features: ${config.features.join(", ")}`);
  console.log(`🔑 Permission: ${config.permissions}`);

  try {
    const group = await getGroupById(config.groupId, config.env);
    await group.sync();

    // Check if current user is super admin (only super admins can change permissions)
    const client = await getClient(config.env);
    const currentUser = client.inboxId;
    const isSuperAdmin = group.isSuperAdmin(currentUser);

    if (!isSuperAdmin) {
      console.error(
        `❌ Only super admins can change group permission policies`,
      );
      console.error(`   Current user: ${currentUser}`);
      console.error(`   Required role: Super Admin`);
      process.exit(1);
    }

    console.log(`\n📝 Permission Update Plan:`);
    config.features.forEach((feature) => {
      console.log(`   • ${feature}: ${config.permissions}`);
    });

    // Update permissions using SDK methods
    let updatedCount = 0;

    for (const feature of config.features) {
      try {
        const permissionType =
          PERMISSION_TYPES[feature as keyof typeof PERMISSION_TYPES];
        const permissionPolicy =
          PERMISSION_POLICIES[
            config.permissions as keyof typeof PERMISSION_POLICIES
          ];

        // Use the SDK's updatePermission method
        await group.updatePermission(
          permissionType as PermissionUpdateType,
          permissionPolicy,
        );
        console.log(
          `   ✅ Updated ${feature} permission to ${config.permissions}`,
        );
        updatedCount++;
      } catch (featureError) {
        console.log(
          `   ❌ Failed to update ${feature}: ${featureError instanceof Error ? featureError.message : String(featureError)}`,
        );
      }
    }

    if (updatedCount > 0) {
      console.log(
        `\n✅ Successfully updated ${updatedCount} out of ${config.features.length} features`,
      );
    } else {
      console.log(`\n❌ No features were updated successfully`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to update permissions: ${errorMessage}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const config = parseArgs();

  switch (config.operation) {
    case "list":
      await runListOperation(config);
      break;
    case "info":
      await runInfoOperation(config);
      break;
    case "update-permissions":
      await runUpdatePermissionsOperation(config);
      break;
    default:
      showHelp();
      break;
  }

  process.exit(0);
}

void main();
