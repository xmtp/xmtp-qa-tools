import { initializeClient } from "@bots/xmtp-handler";
import {
  PermissionPolicy,
  PermissionUpdateType,
  type Client,
  type Conversation,
  type DecodedMessage,
  type Group,
} from "@xmtp/node-sdk";
import { config } from "./groups";

/**
 * Initialize XMTP client for admin operations
 */

export const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
  isDm: boolean,
): Promise<void> => {
  const env = client.options?.env ?? "local";
  const groupConfig = config.find(
    (group: any) =>
      group.publicKey.toLowerCase() ===
      client.accountIdentifier?.identifier.toLowerCase(),
  );
  if (!groupConfig) {
    console.log("No group config found for this client");
    return;
  }
  const groupId = groupConfig.groupId[env];
  const group = await client.conversations.getConversationById(groupId);

  if (!group) {
    console.error(`Group not found with ID: ${groupId}`);
    return;
  }

  await updatePermissions(
    group as Group,
    PermissionUpdateType.AddAdmin,
    PermissionPolicy.SuperAdmin,
  );
  console.log("Permission update complete");
};

/**
 * Update group permissions
 */
async function updatePermissions(
  group: Group,
  updateType: PermissionUpdateType,
  policy: PermissionPolicy,
): Promise<void> {
  try {
    await group.updatePermission(updateType, policy);
    await group.sync();
    const permissions = group.permissions;
    console.log(`Updated permission policy: ${JSON.stringify(permissions)}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error updating permissions: ${errorMessage}`);
  }
}

await initializeClient(processMessage, [
  ...config.map((groupConfig: any) => ({
    walletKey: groupConfig.walletKey,
    networks: groupConfig.networks,
    dbEncryptionKey: groupConfig.encryptionKey,
    publicKey: groupConfig.publicKey,
    welcomeMessage: groupConfig.messages.welcome,
  })),
]);
