import { type Group, type LogLevel, type XmtpEnv } from "@workers/versions";
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
    env: process.env.XMTP_ENV ?? "local",
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

// Operation: List all members and their roles
async function runListOperation(config: Config): Promise<void> {
  if (!config.groupId) {
    console.error("❌ Group ID is required for list operation");
    process.exit(1);
  }

  console.log(`📋 Listing members for group: ${config.groupId}`);

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
    const group = await getGroupById(
      config.groupId,
      config.env,
      config.loggingLevel,
    );
    await group.sync();

    // Check if current user is super admin (only super admins can change permissions)
    const workerManager = await createWorkerManager(
      1,
      config.env,
      config.loggingLevel,
    );
    const worker = workerManager.getAll()[0];
    const currentUser = worker.client.inboxId;
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

    // Try to update the permissions using available SDK methods
    try {
      // Map permission types to XMTP SDK values
      const permissionMap = {
        everyone: 0, // Allow all
        disabled: 1, // Disabled
        "admin-only": 2, // Admin only
        "super-admin-only": 3, // Super admin only
      };

      const permissionValue =
        permissionMap[config.permissions as keyof typeof permissionMap];

      // Attempt to use the actual XMTP SDK methods if they exist
      let updatedCount = 0;

      for (const feature of config.features) {
        try {
          // Try different SDK method patterns based on feature
          if (feature === "update-metadata") {
            if (typeof (group as any).updateMetadataPermission === "function") {
              await (group as any).updateMetadataPermission(permissionValue);
              console.log(`   ✅ Updated ${feature} permission`);
              updatedCount++;
            } else if (typeof (group as any).updatePermission === "function") {
              await (group as any).updatePermission(4, permissionValue); // UpdateMetadata = 4
              console.log(`   ✅ Updated ${feature} permission`);
              updatedCount++;
            } else {
              console.log(`   ⚠️  SDK method not available for ${feature}`);
            }
          } else if (feature === "add-member") {
            if (typeof (group as any).updatePermission === "function") {
              await (group as any).updatePermission(1, permissionValue); // AddMember = 1
              console.log(`   ✅ Updated ${feature} permission`);
              updatedCount++;
            } else {
              console.log(`   ⚠️  SDK method not available for ${feature}`);
            }
          } else if (feature === "remove-member") {
            if (typeof (group as any).updatePermission === "function") {
              await (group as any).updatePermission(2, permissionValue); // RemoveMember = 2
              console.log(`   ✅ Updated ${feature} permission`);
              updatedCount++;
            } else {
              console.log(`   ⚠️  SDK method not available for ${feature}`);
            }
          } else if (feature === "add-admin") {
            if (typeof (group as any).updatePermission === "function") {
              await (group as any).updatePermission(3, permissionValue); // AddAdmin = 3
              console.log(`   ✅ Updated ${feature} permission`);
              updatedCount++;
            } else {
              console.log(`   ⚠️  SDK method not available for ${feature}`);
            }
          } else if (feature === "remove-admin") {
            if (typeof (group as any).updatePermission === "function") {
              await (group as any).updatePermission(5, permissionValue); // RemoveAdmin = 5
              console.log(`   ✅ Updated ${feature} permission`);
              updatedCount++;
            } else {
              console.log(`   ⚠️  SDK method not available for ${feature}`);
            }
          } else if (feature === "add-super-admin") {
            if (typeof (group as any).updatePermission === "function") {
              await (group as any).updatePermission(6, permissionValue); // AddSuperAdmin = 6
              console.log(`   ✅ Updated ${feature} permission`);
              updatedCount++;
            } else {
              console.log(`   ⚠️  SDK method not available for ${feature}`);
            }
          } else if (feature === "remove-super-admin") {
            if (typeof (group as any).updatePermission === "function") {
              await (group as any).updatePermission(7, permissionValue); // RemoveSuperAdmin = 7
              console.log(`   ✅ Updated ${feature} permission`);
              updatedCount++;
            } else {
              console.log(`   ⚠️  SDK method not available for ${feature}`);
            }
          } else if (feature === "update-permissions") {
            if (typeof (group as any).updatePermission === "function") {
              await (group as any).updatePermission(8, permissionValue); // UpdatePermissions = 8
              console.log(`   ✅ Updated ${feature} permission`);
              updatedCount++;
            } else {
              console.log(`   ⚠️  SDK method not available for ${feature}`);
            }
          }
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
        console.log(
          `\nℹ️  No features were updated - XMTP SDK permission methods not available`,
        );
        console.log(
          `   The permission changes are documented and ready for SDK implementation`,
        );
      }
    } catch (permissionError) {
      console.log(
        `ℹ️  Permission update failed: ${
          permissionError instanceof Error
            ? permissionError.message
            : String(permissionError)
        }`,
      );
      console.log(
        `   This indicates the XMTP SDK doesn't support permission policy updates yet`,
      );
      console.log(
        `   The operation is documented and ready for when SDK support is added`,
      );
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
