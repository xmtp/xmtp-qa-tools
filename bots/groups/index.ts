import { getDbPath, validateEnvironment } from "@helpers/client";
import {
  Agent,
  createSigner,
  createUser,
  getTestUrl,
  type AgentContext,
  type Group,
  type XmtpEnv,
} from "@xmtp/agent-sdk";

const isAdmin = [
  "705c87a99e87097ee2044aec0bdb4617634e015db73900453ad56a7da80157ff",
  "c10e8c13c833f1826e98fb0185403c2c4d5737cc432d575468613abf9adae26b",
  "68afe2066b84b48e0b09c2b78be7324a4fb66a973bb0def478ea390312e759b5",
];

// Environment validation
const {
  WALLET_KEY_CSX,
  PUBLIC_KEY_CSX,
  ENCRYPTION_KEY_CSX,
  GROUP_CODE_CSX,
  WALLET_KEY_GANG,
  PUBLIC_KEY_GANG,
  ENCRYPTION_KEY_GANG,
  GROUP_CODE_GANG,
} = validateEnvironment([
  "WALLET_KEY_CSX",
  "ENCRYPTION_KEY_CSX",
  "GROUP_CODE_CSX",
  "WALLET_KEY_GANG",
  "ENCRYPTION_KEY_GANG",
  "GROUP_CODE_GANG",
  "PUBLIC_KEY_CSX",
  "PUBLIC_KEY_GANG",
]);

export type GroupConfig = {
  id: string;
  groupName: string;
  walletKey: string;
  publicKey: string;
  networks: string[];
  dbEncryptionKey: string;
  groupId: {
    production: string;
    dev: string;
    local: string;
  };
  groupCode: string;
  adminInboxIds?: string[];
  messages: {
    welcome: string;
    success: string[];
    invalid: string;
    alreadyInGroup: string;
    error: string;
    groupNotFound?: string;
    adminAdded?: string;
  };
  // Optional customization for message timing
  sleepBetweenMessages?: number;
};

export const config: GroupConfig[] = [
  {
    id: "CSX",
    groupName: "CSX Group chat - test",
    walletKey: WALLET_KEY_CSX,
    publicKey: PUBLIC_KEY_CSX,
    networks: ["dev", "production"],
    dbEncryptionKey: ENCRYPTION_KEY_CSX,
    groupId: {
      production: process.env[`GROUP_ID_PRODUCTION_CSX`] as string,
      dev: process.env[`GROUP_ID_DEV_CSX`] as string,
      local: process.env[`GROUP_ID_LOCAL_CSX`] as string,
    },
    groupCode: GROUP_CODE_CSX,
    messages: {
      welcome: "Hi! I will add you to the groupchat ... what's the passphrase?",
      success: [
        "Nailed it. I've invited you to the groupchat. You'll find your invite in your Security Line, on the Home screen.",
        "When you get there…\n\n🗣️ Introduce yourself + what you're building\n\n👋 Please be respectful or risk being removed.\n\n📰 Share big news! Tag @anna for possible a16z repost.\n\n📆 Post industry events (we'll post a16z events too)\n\n🥳 DM others to connect 1:1..",
      ],
      alreadyInGroup: "You're already in the groupchat, sneaky!",
      invalid: "Invalid code. Please try again.",
      error: "Error adding to group, please try again.",
    },
  },
  {
    id: "GANG",
    groupName: "Gang Group chat - test",
    walletKey: WALLET_KEY_GANG,
    publicKey: PUBLIC_KEY_GANG,
    dbEncryptionKey: ENCRYPTION_KEY_GANG,
    networks: ["dev", "production"],
    groupId: {
      production: process.env[`GROUP_ID_PRODUCTION_GANG`] as string,
      dev: process.env[`GROUP_ID_DEV_GANG`] as string,
      local: process.env[`GROUP_ID_LOCAL_GANG`] as string,
    },
    groupCode: GROUP_CODE_GANG,
    messages: {
      welcome: "Hi! I will add you to the groupchat ... what's the passphrase?",
      success: [
        "Nailed it. I've invited you to the groupchat.",
        "You'll find your invite in your Security Line, on the Home screen.",
      ],
      invalid: "Invalid code. Please try again.",
      alreadyInGroup: "You're already in the groupchat, sneaky!",
      error: "Error adding to group, please try again.",
    },
  },
];

/**
 * Process an incoming message
 */
export const processMessage = async (ctx: AgentContext): Promise<void> => {
  const groupConfig = config.find(
    (group) =>
      group.publicKey.toLowerCase() ===
      ctx.client.accountIdentifier?.identifier.toLowerCase(),
  );
  if (!groupConfig) {
    console.warn("No group config found for this client");
    return;
  }

  try {
    const envKey = ctx.client.options?.env as XmtpEnv;

    // Create the configuration for the group addition skill
    const addToGroupConfig = createAddToGroupConfig(
      groupConfig,
      envKey,
      isAdmin,
    );

    // Use the new skill to handle group addition
    await addToGroupWithCustomCopy(ctx, addToGroupConfig);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing message:`, errorMessage);
    // Let the user know something went wrong
    await ctx.conversation.send(groupConfig.messages.error);
  }
  return;
};

// 2. Spin up the agent
const csx = await Agent.create(createSigner(createUser()), {
  env: process.env.XMTP_ENV as "local" | "dev" | "production", // or 'production'
  dbPath: getDbPath(`groups-bot`),
  appVersion: "groups/1.0.0",
});

csx.on("text", async (ctx) => {
  await processMessage(ctx);
});

csx.on("start", () => {
  console.log(`We are online: ${getTestUrl(csx)}`);
});

await csx.start();

/**
 * Add a user to a group with customizable copy
 * @param client The XMTP client
 * @param conversation The conversation to respond in
 * @param message The decoded message
 * @param config Configuration for the group addition
 * @returns Promise<boolean> - true if user was added, false if already in group
 */
export const addToGroupWithCustomCopy = async (
  ctx: AgentContext,
  config: AddToGroupConfig,
): Promise<boolean> => {
  try {
    // Get the group conversation
    const group = await ctx.client.conversations.getConversationById(
      config.groupId,
    );

    if (!group) {
      console.debug(`Group not found in the db: ${config.groupId}`);
      const errorMessage =
        config.messages.groupNotFound ||
        "Group not found in the db, contact the admin";
      await ctx.conversation.send(errorMessage);
      return false;
    }

    // Check the message content against the secret code
    if (ctx.message.content !== config.groupCode) {
      await ctx.conversation.send(config.messages.invalid);
      return false;
    }

    console.debug(`Secret code received, processing group addition`);

    await (group as Group).sync();
    if (
      (await ctx.conversation.metadata()).conversationType === "dm" ||
      (await ctx.conversation.metadata()).conversationType === "group"
    ) {
      const members = await (group as Group).members();
      const isMember = members.some(
        (member) =>
          member.inboxId.toLowerCase() ===
          ctx.message.senderInboxId.toLowerCase(),
      );

      if (!isMember) {
        console.debug(
          `Adding member ${ctx.message.senderInboxId} to group ${config.groupId}`,
        );
        await (group as Group).addMembers([ctx.message.senderInboxId]);

        // Check if user should be admin
        if (config.adminInboxIds?.includes(ctx.message.senderInboxId)) {
          console.debug(
            `Adding admin ${ctx.message.senderInboxId} to group ${config.groupId}`,
          );
          await (group as Group).addSuperAdmin(ctx.message.senderInboxId);
        }

        // Send success messages with optional delay
        for (const successMessage of config.messages.success) {
          await ctx.conversation.send(successMessage);
        }
        return true;
      } else {
        // User is already in group, check if they need admin privileges
        const isAdminFromGroup = (group as Group).isSuperAdmin(
          ctx.message.senderInboxId,
        );
        if (
          !isAdminFromGroup &&
          config.adminInboxIds?.includes(ctx.message.senderInboxId)
        ) {
          console.debug(
            `Adding admin privileges to ${ctx.message.senderInboxId} in group ${config.groupId}`,
          );
          await (group as Group).addSuperAdmin(ctx.message.senderInboxId);
        }

        console.debug(
          `Member ${ctx.message.senderInboxId} already in group ${config.groupId}`,
        );
        await ctx.conversation.send(config.messages.alreadyInGroup);
        return false;
      }
    }

    throw new Error("Group is not a valid Group instance");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing group addition:`, errorMessage);
    await ctx.conversation.send(config.messages.error);
    return false;
  }
};

/**
 * Helper function to create AddToGroupConfig from GroupConfig
 * @param groupConfig The group configuration
 * @param envKey The environment key (dev, production, local)
 * @param adminInboxIds Optional array of admin inbox IDs
 * @returns AddToGroupConfig
 */
export type AddToGroupConfig = {
  groupId: string;
  groupCode: string;
  adminInboxIds?: string[];
  messages: {
    welcome: string;
    success: string[];
    invalid: string;
    alreadyInGroup: string;
    error: string;
    groupNotFound?: string;
    adminAdded?: string;
  };
  sleepBetweenMessages?: number;
};

export const createAddToGroupConfig = (
  groupConfig: {
    groupId: Record<string, string>;
    groupCode: string;
    messages: {
      welcome: string;
      success: string[];
      alreadyInGroup: string;
      invalid: string;
      error: string;
      groupNotFound?: string;
      adminAdded?: string;
    };
    sleepBetweenMessages?: number;
  },
  envKey: string,
  adminInboxIds?: string[],
): AddToGroupConfig => {
  return {
    groupId: groupConfig.groupId[envKey],
    groupCode: groupConfig.groupCode,
    adminInboxIds,
    messages: {
      welcome: groupConfig.messages.welcome,
      success: groupConfig.messages.success,
      alreadyInGroup: groupConfig.messages.alreadyInGroup,
      invalid: groupConfig.messages.invalid,
      error: groupConfig.messages.error,
      groupNotFound:
        groupConfig.messages.groupNotFound ||
        "Group not found in the db, contact the admin",
    },
    sleepBetweenMessages: groupConfig.sleepBetweenMessages || 500,
  };
};
