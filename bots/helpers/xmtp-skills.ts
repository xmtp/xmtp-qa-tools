import {
  type Client,
  type Conversation,
  type DecodedMessage,
} from "@xmtp/node-sdk";
import type { AgentOptions } from "./xmtp-handler";

export const sendWelcomeMessage = async (
  client: Client<any>,
  conversation: Conversation,
  message: string,
) => {
  await conversation.sync();
  const messages = await conversation.messages();
  const hasSentBefore = messages.some(
    (msg) => msg.senderInboxId.toLowerCase() === client.inboxId.toLowerCase(),
  );

  if (!hasSentBefore) {
    await conversation.send(message);
    return true;
  }
  return false;
};

/**
 * Extract command from message content
 * @param content The message content to parse
 * @param commandPrefix The command prefix to look for (default: "@toss")
 * @returns The command string or null if no command found
 */
export function extractCommand(
  content: string,
  commandPrefix: string = "@toss",
): string | null {
  // Escape special regex characters in the prefix
  const escapedPrefix = commandPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const botMentionRegex = new RegExp(`${escapedPrefix}\\s+(.*)`, "i");
  const botMentionMatch = content.match(botMentionRegex);
  return botMentionMatch ? botMentionMatch[1].trim() : null;
}

/**
 * Check if a message contains a valid command
 * @param message The decoded message to check
 * @param commandPrefix The command prefix to look for (default: "@toss")
 * @returns True if the message contains a command, false otherwise
 */
export function isCommand(
  message: DecodedMessage,
  commandPrefix: string = "@toss",
): boolean {
  if (message.contentType?.typeId !== "text") {
    return false;
  }

  const command = extractCommand(message.content as string, commandPrefix);
  return command !== null;
}

/**
 * Check if a message is a transaction reference
 * @param message The decoded message to check
 * @returns True if the message is a transaction reference
 */
export function isTransactionReference(message: DecodedMessage): boolean {
  return message.contentType?.typeId === "transactionReference";
}

/**
 * Parse command into parts
 * @param command The command string to parse
 * @returns Object with command name and arguments
 */
export function parseCommand(command: string): {
  name: string;
  args: string[];
} {
  const parts = command.split(" ");
  return {
    name: parts[0].toLowerCase(),
    args: parts.slice(1),
  };
}

/**
 * Check if a command is an explicit command from the allowed list
 * @param commandName The command name to check
 * @param allowedCommands Array of allowed command names
 * @returns True if it's an explicit command
 */
export function isExplicitCommand(
  commandName: string,
  allowedCommands: string[] = ["help"],
): boolean {
  return allowedCommands
    .map((cmd) => cmd.toLowerCase())
    .includes(commandName.toLowerCase());
}

/**
 * Extract command configuration from agent options
 * @param options Agent options
 * @returns Command configuration object
 */
export function getCommandConfig(options: AgentOptions): {
  prefix: string;
  allowedCommands: string[];
} {
  return {
    prefix: options.commandPrefix || "@toss",
    allowedCommands: options.allowedCommands || ["help"],
  };
}

/**
 * Check if a message should be processed based on command configuration
 * @param message The decoded message
 * @param options Agent options
 * @returns True if the message should be processed
 */
export function shouldProcessMessage(
  message: DecodedMessage,
  options: AgentOptions,
): boolean {
  const config = getCommandConfig(options);
  const messageAnalysis = processMessageCommands(message, config.prefix);

  // Always process transaction references
  if (messageAnalysis.isTransaction) {
    console.debug("Processing transaction reference");
    return true;
  }

  // Process any message that has the command prefix (both explicit commands and natural language prompts)
  if (messageAnalysis.hasCommand) {
    // If it's an explicit command, check if it's allowed
    if (
      messageAnalysis.commandData &&
      isExplicitCommand(
        messageAnalysis.commandData.name,
        config.allowedCommands,
      )
    ) {
      console.debug(
        `Processing explicit command: ${messageAnalysis.commandData.name}`,
      );
      return true;
    }

    // If it's not an explicit command, treat it as a natural language prompt and allow it
    if (
      messageAnalysis.commandData &&
      !isExplicitCommand(
        messageAnalysis.commandData.name,
        config.allowedCommands,
      )
    ) {
      console.debug(
        `Processing natural language prompt: ${messageAnalysis.command}`,
      );
      return true;
    }
  }

  console.debug("Message filtered out - no command or transaction reference");
  return false;
}

export const preMessageHandler = async (
  client: Client<any>,
  conversation: Conversation,
  message: DecodedMessage,
  isDm: boolean,
  options: AgentOptions,
) => {
  // Handle welcome messages first
  if (options.welcomeMessage && isDm) {
    const sent = await sendWelcomeMessage(
      client,
      conversation,
      options.welcomeMessage,
    );
    if (sent) return true;
  }

  if (options.groupWelcomeMessage && !isDm && options.acceptGroups) {
    const sent = await sendWelcomeMessage(
      client,
      conversation,
      options.groupWelcomeMessage,
    );
    if (sent) return true;
  }

  // Filter messages based on command configuration
  if (!shouldProcessMessage(message, options)) {
    return true; // Skip processing
  }

  return false;
};

/**
 * Enhanced message handler that includes command detection and filtering
 * @param message The decoded message
 * @param commandPrefix The command prefix to look for (default: "@toss")
 * @returns Object with command detection results and whether to continue processing
 */
export const processMessageCommands = (
  message: DecodedMessage,
  commandPrefix: string = "@toss",
): {
  hasCommand: boolean;
  isTransaction: boolean;
  command?: string;
  commandData?: { name: string; args: string[] };
} => {
  const hasCommand = isCommand(message, commandPrefix);
  const isTransaction = isTransactionReference(message);

  let command: string | undefined;
  let commandData: { name: string; args: string[] } | undefined;

  if (hasCommand) {
    command = extractCommand(message.content as string, commandPrefix) ?? "";
    commandData = parseCommand(command);
  }

  return {
    hasCommand,
    isTransaction,
    command,
    commandData,
  };
};
