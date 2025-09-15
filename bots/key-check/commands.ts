// Command definitions and help text for key-check bot

export const COMMANDS = {
  HELP: "help",
  GROUP_ID: "groupid",
  VERSION: "version",
  UPTIME: "uptime",
  DEBUG: "debug",
  MEMBERS: "members",
  INBOX_ID: "inboxid",
  ADDRESS: "address",
  FORK: "fork",
  // UX Demo commands
  UX_HELP: "ux",
  UX_REACTION: "ux-reaction",
  UX_REPLY: "ux-reply",
  UX_ATTACHMENT: "ux-attachment",
  UX_TEXT: "ux-text",
  UX_ALL: "ux-all",
} as const;

export const HELP_TEXT =
  "Available commands:\n\n" +
  "**Key Package & Fork Detection:**\n" +
  "/kc - Check key package status for the sender\n" +
  "/kc inboxid <INBOX_ID> - Check key package status for a specific inbox ID\n" +
  "/kc address <ADDRESS> - Check key package status for a specific address\n" +
  "/kc fork - Detect potential conversation forks and show detailed debug info\n\n" +
  "**Conversation Info:**\n" +
  "/kc groupid - Show the current conversation ID\n" +
  "/kc members - List all members' inbox IDs in the current conversation\n\n" +
  "**UX Demo - Message Types:**\n" +
  "/kc ux - Show UX demo help and available message types\n" +
  "/kc ux-reaction - Send a reaction to the last message\n" +
  "/kc ux-reply - Send a reply to the last message\n" +
  "/kc ux-attachment - Show attachment implementation demo\n" +
  "/kc ux-text - Send a regular text message\n" +
  "/kc ux-all - Send one of each message type (text, reply, reaction, attachment demo)\n\n" +
  "**Bot Info:**\n" +
  "/kc version - Show XMTP SDK version information\n" +
  "/kc uptime - Show when the bot started and how long it has been running\n" +
  "/kc debug - Show debug information for the key-check bot\n" +
  "/kc help - Show this help message";

export const UX_HELP_TEXT =
  "🎨 **UX Demo - Message Types Showcase**\n\n" +
  "Commands:\n" +
  "/kc ux-reaction - Send a reaction to the last message\n" +
  "/kc ux-reply - Send a reply to the last message\n" +
  "/kc ux-attachment - Show attachment implementation demo\n" +
  "/kc ux-text - Send a regular text message\n" +
  "/kc ux-all - Send one of each message type\n" +
  "/kc ux - Show this UX demo help\n\n" +
  "This demonstrates different XMTP message types for UX testing.\n" +
  "Send any message first, then try reactions and replies!";

export function parseCommand(content: string): {
  command: string;
  parts: string[];
} {
  const parts = content.trim().split(/\s+/);
  const command = parts.length > 1 ? parts[1] : "";
  return { command, parts };
}
