import { initializeClient } from "@bots/xmtp-handler";
import {
  PermissionPolicy,
  PermissionUpdateType,
  type Client,
  type Conversation,
  type DecodedMessage,
  type Group,
} from "@xmtp/node-sdk";
import manualUsers from "../../helpers/manualusers.json";
import { config, type GroupConfig } from "./groups";

const isAdmin = manualUsers.map((user) => user.inboxId);

export const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
): Promise<void> => {
  console.log("Processing message", config);
  const groupConfig = config.find(
    (group: GroupConfig) =>
      group.publicKey.toLowerCase() ===
      client.accountIdentifier?.identifier.toLowerCase(),
  );
  if (!groupConfig) {
    console.log("No group config found for this client");
    return;
  }
  const content = message.content as string;
  if (!content.includes("/admin")) {
    console.log("non admin message detected");
    return;
  }

  if (!isAdmin.includes(message.senderInboxId)) {
    console.log("non admin message detected");
    return;
  }

  console.log("admin message detected" + message.senderInboxId);
  console.log(client.accountIdentifier?.identifier);

  await client.conversations.sync();
  const env = client.options?.env ?? "local";

  const groupId = groupConfig.groupId[env];
  const group = await client.conversations.getConversationById(groupId);

  if (!group) {
    console.error(`Group not found with ID: ${groupId}`);
    return;
  }
  await group.sync();
  const groupName = (group as Group).name;
  const permissions = await updatePermissions(group as Group);
  await conversation.send(
    `Updated permission policy: ${JSON.stringify(permissions)}`,
  );
  console.log("Permission update complete");
  await conversation.send(
    "Permission update complete for " + groupName + " " + groupId,
  );
};

/**
 * Update group permissions
 */
async function updatePermissions(group: Group): Promise<string> {
  try {
    await group.updatePermission(
      PermissionUpdateType.AddAdmin,
      PermissionPolicy.Admin,
    );
    await group.updatePermission(
      PermissionUpdateType.AddMember,
      PermissionPolicy.Admin,
    );
    await group.updatePermission(
      PermissionUpdateType.RemoveMember,
      PermissionPolicy.Admin,
    );
    await group.updatePermission(
      PermissionUpdateType.RemoveAdmin,
      PermissionPolicy.SuperAdmin,
    );
    await group.updatePermission(
      PermissionUpdateType.UpdateMetadata,
      PermissionPolicy.Admin,
      0, // name field
    );
    await group.updatePermission(
      PermissionUpdateType.UpdateMetadata,
      PermissionPolicy.Admin,
      1, // description field
    );
    await group.updatePermission(
      PermissionUpdateType.UpdateMetadata,
      PermissionPolicy.Admin,
      2, // image field
    );

    await group.sync();
    const permissions = group.permissions;
    return JSON.stringify(permissions);
  } catch (error: unknown) {
    console.error(error);
    return "";
  }
}

await initializeClient(processMessage, [
  ...config.map((groupConfig: GroupConfig) => ({
    walletKey: groupConfig.walletKey,
    networks: groupConfig.networks,
    dbEncryptionKey: groupConfig.encryptionKey,
    publicKey: groupConfig.publicKey,
  })),
]);
