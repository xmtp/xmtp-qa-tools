import { initializeClient } from "@bots/xmtp-handler";
import {
  PermissionPolicy,
  PermissionUpdateType,
  type Client,
  type Conversation,
  type DecodedMessage,
  type Group,
} from "@xmtp/node-sdk";
import { config, type GroupConfig } from "./groups";

const isAdmin = [
  "7c700cd57fe7a5c05b9dae39da6bdc7adfe73f0ec02ad82aa65de879004166f3", //xmtpchat
  "c10e8c13c833f1826e98fb0185403c2c4d5737cc432d575468613abf9adae26b", //convos
  "68afe2066b84b48e0b09c2b78be7324a4fb66a973bb0def478ea390312e759b5", //convos
];

/**
 * Initialize XMTP client for admin operations
 */

export const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
): Promise<void> => {
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
  if (!content.includes("/admin") && !isAdmin.includes(message.senderInboxId)) {
    console.log("non admin message detected");
    return;
  } else {
    console.log("admin message detected" + message.senderInboxId);
    console.log(client.accountIdentifier?.identifier);
  }
  await client.conversations.sync();
  const env = client.options?.env ?? "local";

  const groupId = groupConfig.groupId[env];
  const group = await client.conversations.getConversationById(groupId);

  if (!group) {
    console.error(`Group not found with ID: ${groupId}`);
    return;
  }

  await updatePermissions(group as Group);
  console.log("Permission update complete");
  await conversation.send("Permission update complete");
};

/**
 * Update group permissions
 */
async function updatePermissions(group: Group): Promise<void> {
  try {
    await group.updatePermission(
      PermissionUpdateType.AddAdmin,
      PermissionPolicy.SuperAdmin,
    );
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
  })),
]);
