import { validateEnvironment } from "@helpers/client";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "version-management/client-versions";
import {
  addToGroupWithCustomCopy,
  createAddToGroupConfig,
  initializeClient,
  type MessageContext,
  type SkillOptions,
} from "../xmtp-skills";

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
export const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
): Promise<void> => {
  const groupConfig = config.find(
    (group) =>
      group.publicKey.toLowerCase() ===
      client.accountIdentifier?.identifier.toLowerCase(),
  );
  if (!groupConfig) {
    console.warn("No group config found for this client");
    return;
  }

  try {
    const envKey = client.options?.env as XmtpEnv;

    // Create the configuration for the group addition skill
    const addToGroupConfig = createAddToGroupConfig(
      groupConfig,
      envKey,
      isAdmin,
    );

    // Use the new skill to handle group addition
    await addToGroupWithCustomCopy(
      client,
      conversation,
      message,
      addToGroupConfig,
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing message:`, errorMessage);
    // Let the user know something went wrong
    await conversation.send(groupConfig.messages.error);
  }
  return;
};

// Create client options with skill options included
const configs: SkillOptions[] = config.map((group: GroupConfig) => ({
  networks: process.env.XMTP_NETWORKS?.split(",") ?? ["dev"],
  walletKey: group.walletKey as `0x${string}`,
  dbEncryptionKey: group.dbEncryptionKey,
  publicKey: group.publicKey,
  // Skill options
  welcomeMessage: group.messages.welcome,
  acceptGroups: false,
  acceptTypes: ["text"],
  allowedCommands: ["help"],
  appVersion: "groups/1.0.0",
  commandPrefix: "",
  strictCommandFiltering: false,
  codecs: [],
  indexVersion: 0,
}));

await initializeClient(processMessage, configs);
