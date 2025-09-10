import { getDbPath } from "@helpers/client";
import {
  Agent,
  createSigner,
  createUser,
  getEncryptionKeyFromHex,
  getTestUrl,
  type Group,
} from "@xmtp/agent-sdk";

const groupId = {
  production: process.env.GROUP_ID_PRODUCTION_GANG as string,
  dev: process.env.GROUP_ID_DEV_GANG as string,
};

const isAdmin = [
  "705c87a99e87097ee2044aec0bdb4617634e015db73900453ad56a7da80157ff",
  "c10e8c13c833f1826e98fb0185403c2c4d5737cc432d575468613abf9adae26b",
  "68afe2066b84b48e0b09c2b78be7324a4fb66a973bb0def478ea390312e759b5",
];

const messages = {
  success: [
    "Welcome to GANG! You've been added to the group.",
    "Check your conversations to see the group chat.",
  ],
  invalid: "Invalid code. Please try again with the correct passphrase.",
  alreadyInGroup: "You're already in the GANG group!",
  groupNotFound:
    "GANG group not found in the database. Please contact an admin.",
  error: "Error processing your request. Please try again.",
};

const signer = createSigner(
  createUser(process.env.XMTP_WALLET_KEY_GANG as `0x${string}`),
);
const signerIdentifier = (await signer.getIdentifier()).identifier;

const agent = await Agent.create(signer, {
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  dbEncryptionKey: getEncryptionKeyFromHex(
    process.env.XMTP_DB_ENCRYPTION_KEY_GANG as string,
  ),
  dbPath: getDbPath(`${process.env.XMTP_ENV}-${signerIdentifier}`),
  appVersion: "gang-group/0",
});

// Handle uncaught errors
agent.on("unhandledError", (error) => {
  console.error("GANG agent error", error);
});

agent.on("text", async (ctx) => {
  const env = ctx.client.options?.env as "dev" | "production";
  const currentGroupId = groupId[env];
  const currentGroupCode = process.env.XMTP_GROUP_CODE_GANG as string;

  // Get the group conversation
  const group =
    await ctx.client.conversations.getConversationById(currentGroupId);

  if (!group) {
    console.debug(`Group not found in the db: ${currentGroupId}`);
    await ctx.conversation.send(messages.groupNotFound);
    return false;
  }

  // Check the message content against the secret code
  if (ctx.message.content !== currentGroupCode) {
    await ctx.conversation.send(messages.invalid);
    return false;
  }

  console.debug("Secret code received, processing group addition");

  await (group as Group).sync();
  const conversationMetadata = await ctx.conversation.metadata();
  if (
    conversationMetadata.conversationType === "dm" ||
    conversationMetadata.conversationType === "group"
  ) {
    const members = await (group as Group).members();
    const isMember = members.some(
      (member) =>
        member.inboxId.toLowerCase() ===
        ctx.message.senderInboxId.toLowerCase(),
    );

    if (!isMember) {
      console.debug(
        `Adding member ${ctx.message.senderInboxId} to group ${currentGroupId}`,
      );
      await (group as Group).addMembers([ctx.message.senderInboxId]);

      // Check if user should be admin
      if (isAdmin.includes(ctx.message.senderInboxId)) {
        console.debug(
          `Adding admin ${ctx.message.senderInboxId} to group ${currentGroupId}`,
        );
        await (group as Group).addSuperAdmin(ctx.message.senderInboxId);
      }

      // Send success messages
      for (const successMessage of messages.success) {
        await ctx.conversation.send(successMessage);
      }
      return true;
    } else {
      // User is already in group, check if they need admin privileges
      const isAdminFromGroup = (group as Group).isSuperAdmin(
        ctx.message.senderInboxId,
      );
      if (!isAdminFromGroup && isAdmin.includes(ctx.message.senderInboxId)) {
        console.debug(
          `Adding admin privileges to ${ctx.message.senderInboxId} in group ${currentGroupId}`,
        );
        await (group as Group).addSuperAdmin(ctx.message.senderInboxId);
      }

      console.debug(
        `Member ${ctx.message.senderInboxId} already in group ${currentGroupId}`,
      );
      await ctx.conversation.send(messages.alreadyInGroup);
      return false;
    }
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
});

await agent.start();
