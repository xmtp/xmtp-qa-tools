import { validateEnvironment } from "@helpers/tests";

// Environment validation
const {
  WALLET_KEY_CSX,
  ENCRYPTION_KEY_CSX,
  GROUP_CODE_CSX,
  WALLET_KEY_GANG,
  ENCRYPTION_KEY_GANG,
  GROUP_CODE_GANG,
} = validateEnvironment([
  "WALLET_KEY_CSX",
  "ENCRYPTION_KEY_CSX",
  "GROUP_CODE_CSX",
  "WALLET_KEY_GANG",
  "ENCRYPTION_KEY_GANG",
  "GROUP_CODE_GANG",
]);

export type GroupConfig = {
  name: string;
  walletKey: string;
  encryptionKey: string;
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
    groupNotFound: string;
  };
};

export const config: GroupConfig[] = [
  {
    name: "CSX Group chat - test",
    walletKey: WALLET_KEY_CSX,
    encryptionKey: ENCRYPTION_KEY_CSX,
    groupId: {
      production: process.env[`GROUP_ID_PRODUCTION_CSX`] as string,
      dev: process.env[`GROUP_ID_DEV_CSX`] as string,
      local: process.env[`GROUP_ID_LOCAL_CSX`] as string,
    },
    groupCode: GROUP_CODE_CSX,
    messages: {
      welcome: "Hi! I will add you to the groupchat ... what's the passphrase?",
      success: [
        "Nailed it. I've invited you to the groupchat.",
        "You'll find your invite in your Security Line, on the Home screen.",
      ],
      alreadyInGroup: "You're already in the groupchat, sneaky!",
      invalid: "Invalid code. Please try again.",
      error: "Error adding to group, please try again.",
      groupNotFound: "Invalid Group not found, skipping.",
    },
  },
  {
    name: "Gang Group chat - test",
    walletKey: WALLET_KEY_GANG,
    encryptionKey: ENCRYPTION_KEY_GANG,
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
      groupNotFound: "Invalid Group not found, skipping.",
    },
  },
];
