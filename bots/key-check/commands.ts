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
  "**Bot Info:**\n" +
  "/kc version - Show XMTP SDK version information\n" +
  "/kc uptime - Show when the bot started and how long it has been running\n" +
  "/kc debug - Show debug information for the key-check bot\n" +
  "/kc help - Show this help message";

export function parseCommand(content: string): {
  command: string;
  parts: string[];
} {
  const parts = content.trim().split(/\s+/);
  const command = parts.length > 1 ? parts[1] : "";
  return { command, parts };
}
