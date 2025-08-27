import "dotenv/config";
import {
  createSigner,
  generateEncryptionKeyHex,
  getDbPath,
  getEncryptionKeyFromHex,
  logAgentDetails,
} from "@helpers/client";
import {
  APP_VERSION,
  getActiveVersion,
  type Client,
  type Conversation,
  type DecodedMessage,
  type Group,
  type LogLevel,
  type XmtpEnv,
} from "version-management/client-versions";
import { generatePrivateKey } from "viem/accounts";

/**
 * Skill-related options for message processing
 */
export interface SkillOptions {
  acceptGroups?: boolean;
  acceptTypes?: string[];
  welcomeMessage?: string;
  groupWelcomeMessage?: string;
  allowedCommands?: string[];
  commandPrefix?: string;
  strictCommandFiltering?: boolean;
  codecs?: any[];
  walletKey?: string;
  dbEncryptionKey?: string;
  networks?: string[];
  loggingLevel?: LogLevel;
  indexVersion: number;
}

/**
 * Handle message streaming with onMessage callback
 */
const handleStream = async (
  client: Client,
  callBack: MessageHandler,
  skillOpts: SkillOptions,
): Promise<void> => {
  const env = client.options?.env;

  try {
    console.log(`[${env}] Waiting for messages...`);
    const stream = await client.conversations.streamAllMessages();

    for await (const message of stream) {
      // Process message asynchronously
      void (async () => {
        try {
          await processMessage(
            client,
            message,
            callBack,
            skillOpts,
            env || "unknown",
          );
        } catch (err: unknown) {
          console.error(`[${env}] Error processing message:`, err);
        }
      })();
    }
  } catch (err: unknown) {
    console.error(`[${env}] Error streaming messages:`, err);
    throw err;
  }
};

/**
 * Initialize XMTP clients with error handling
 */
export const initializeClient = async (
  messageHandler: MessageHandler,
  coreOptions: SkillOptions[],
): Promise<Client[]> => {
  const clients: Client[] = [];
  const streamPromises: Promise<void>[] = [];

  // Merge default options with the provided options
  const mergedCoreOptions = coreOptions.map((opt) => ({
    acceptGroups: false,
    acceptTypes: ["text"],
    welcomeMessage: "",
    groupWelcomeMessage: "",
    allowedCommands: ["help"],
    commandPrefix: "",
    strictCommandFiltering: false,
    walletKey: (process.env.WALLET_KEY ??
      generatePrivateKey()) as `0x${string}`,
    dbEncryptionKey: process.env.ENCRYPTION_KEY ?? generateEncryptionKeyHex(),
    loggingLevel: (process.env.LOGGING_LEVEL || "warn") as LogLevel,
    networks: [process.env.XMTP_ENV || "production"] as string[],
    codecs: [],
    ...opt,
  }));

  for (const option of mergedCoreOptions) {
    for (const env of option.networks) {
      try {
        const signer = createSigner(option.walletKey);
        const dbEncryptionKey = getEncryptionKeyFromHex(
          option.dbEncryptionKey || generateEncryptionKeyHex(),
        );
        const signerIdentifier = (await signer.getIdentifier()).identifier;

        // Extract skill options from the client options
        const skillOptions: SkillOptions = {
          acceptGroups: option.acceptGroups,
          indexVersion: option.indexVersion,
          acceptTypes: option.acceptTypes,
          welcomeMessage: option.welcomeMessage,
          groupWelcomeMessage: option.groupWelcomeMessage,
          allowedCommands: option.allowedCommands,
          commandPrefix: option.commandPrefix,
          strictCommandFiltering: option.strictCommandFiltering,
          codecs: option.codecs,
        };

        // @ts-expect-error - TODO: fix this
        const client = await getActiveVersion(1).Client.create(signer, {
          dbEncryptionKey,
          env: env as XmtpEnv,
          loggingLevel: option.loggingLevel,
          dbPath: getDbPath(`${env}-${signerIdentifier}`),
          codecs: skillOptions.codecs ?? [],
          appVersion: APP_VERSION,
        });

        // @ts-expect-error - TODO: fix this
        clients.push(client);

        const streamPromise = handleStream(
          // @ts-expect-error - TODO: fix this
          client,
          messageHandler,
          skillOptions,
        );

        streamPromises.push(streamPromise);
      } catch (error) {
        console.error(`[${env}] Client initialization error:`, error);
      }
    }
  }

  await logAgentDetails(clients);
  return clients;
};

/**
 * Message context with analysis results
 */
export interface MessageContext {
  isDm: boolean;
  options: SkillOptions;
  type: string;
  command: string;
  hasCommand: boolean;
  commandData: { name: string; args: string[] };
}

/**
 * Message handler callback type
 */
export type MessageHandler = (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
  messageContext: MessageContext,
) => Promise<void> | void;

export const sendWelcomeMessage = async (
  client: Client,
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
 * @param commandPrefix The command prefix to look for (default: "@")
 * @returns The command string or null if no command found
 */
export function extractCommand(
  content: string,
  commandPrefix: string = "@",
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
 * @param commandPrefix The command prefix to look for (default: "@")
 * @returns True if the message contains a command, false otherwise
 */
export function isCommand(
  message: DecodedMessage,
  commandPrefix: string = "@",
): boolean {
  if (message.contentType?.typeId !== "text") {
    return false;
  }

  const command = extractCommand(message.content as string, commandPrefix);
  return command !== null;
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
export function getCommandConfig(options: SkillOptions): {
  prefix: string;
  allowedCommands: string[];
} {
  return {
    prefix: options.commandPrefix || "@",
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
  options: SkillOptions,
): boolean {
  // If no command prefix is configured, process all messages
  if (!options.commandPrefix) {
    console.debug("No command prefix configured - processing all messages");
    return true;
  }

  const config = getCommandConfig(options);
  const messageAnalysis = processMessageCommands(message, config.prefix);

  // If message has the command prefix, process it
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

  // If command prefix is configured but message doesn't have it,
  // still process the message (for backward compatibility and flexibility)
  console.debug("Processing message without command prefix");
  return true;
}

export const preMessageHandler = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
  isDm: boolean,
  options: SkillOptions,
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

  // Only filter messages if explicitly configured to do so
  if (
    options.strictCommandFiltering &&
    !shouldProcessMessage(message, options)
  ) {
    return true; // Skip processing
  }

  return false;
};

/**
 * Enhanced message handler that includes command detection
 * @param message The decoded message
 * @param commandPrefix The command prefix to look for (default: "@")
 * @returns Object with command detection results
 */
export const processMessageCommands = (
  message: DecodedMessage,
  commandPrefix: string = "@",
): {
  hasCommand: boolean;
  command?: string;
  commandData?: { name: string; args: string[] };
} => {
  const hasCommand = isCommand(message, commandPrefix);

  let command: string | undefined;
  let commandData: { name: string; args: string[] } | undefined;

  if (hasCommand) {
    command = extractCommand(message.content as string, commandPrefix) ?? "";
    commandData = parseCommand(command);
  }

  return {
    hasCommand,
    command,
    commandData,
  };
};

/**
 * Get sender address from inbox ID
 */
export const getSenderAddress = async (
  client: Client,
  senderInboxId: string,
): Promise<string> => {
  const inboxState = await client.preferences.inboxStateFromInboxIds([
    senderInboxId,
  ]);

  if (!inboxState[0]?.identifiers[0]?.identifier) {
    throw new Error(`Unable to get address for inbox ID: ${senderInboxId}`);
  }

  return inboxState[0].identifiers[0].identifier;
};

/**
 * Core message processing logic moved from xmtp-handler
 * @param client The XMTP client
 * @param message The decoded message
 * @param messageHandler The message handler callback
 * @param options Skill options for message processing
 * @param env Environment string for logging
 */
export const processMessage = async (
  client: Client,
  message: DecodedMessage,
  messageHandler: MessageHandler,
  options: SkillOptions,
  env: string,
): Promise<void> => {
  try {
    // Skip messages from self or with unsupported content types
    const acceptTypes = options.acceptTypes || ["text"];
    const messageContentType = message.contentType?.typeId as string;

    if (
      message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      !acceptTypes.includes(messageContentType)
    ) {
      return;
    }

    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.debug(`[${env}] Unable to find conversation, skipping`);
      return;
    }

    console.debug(
      `[${env}] Received message: ${message.content as string} from ${message.senderInboxId}`,
    );
    const isDm = (await conversation.metadata()).conversationType === "dm";
    const isGroup =
      (await conversation.metadata()).conversationType === "group";

    const preMessageHandlerResult = await preMessageHandler(
      client,
      conversation,
      message,
      isDm,
      options,
    );
    if (preMessageHandlerResult) {
      console.debug(`[${env}] Pre-message handler returned true, skipping`);
      return;
    }

    if (isDm || (isGroup && options.acceptGroups)) {
      try {
        console.debug(
          `[${env}] Processing message ${message.content as string}...`,
        );

        // Get command configuration and analyze message
        const commandConfig = getCommandConfig(options);
        const analysis = processMessageCommands(message, commandConfig.prefix);

        const messageContext: MessageContext = {
          isDm,
          options,
          type: message.contentType?.typeId || "text",
          command: analysis.command || "",
          hasCommand: analysis.hasCommand,
          commandData: analysis.commandData || { name: "", args: [] },
        };

        await messageHandler(client, conversation, message, messageContext);
      } catch (handlerError) {
        console.error(`[${env}] Error in message handler:`, handlerError);
      }
    } else {
      console.debug(
        `[${env}] Conversation is not a DM and acceptGroups=false, skipping`,
      );
    }
  } catch (error) {
    // Handle errors within message processing without breaking the stream
    console.error(`[${env}] Error processing message:`, error);
  }
};

/**
 * Configuration for adding someone to a group
 */
export interface AddToGroupConfig {
  groupId: string;
  groupCode: string;
  adminInboxIds?: string[];
  messages: {
    success: string[];
    alreadyInGroup: string;
    invalid: string;
    error: string;
    groupNotFound?: string;
  };
  sleepBetweenMessages?: number;
}

/**
 * Add a user to a group with customizable copy
 * @param client The XMTP client
 * @param conversation The conversation to respond in
 * @param message The decoded message
 * @param config Configuration for the group addition
 * @returns Promise<boolean> - true if user was added, false if already in group
 */
export const addToGroupWithCustomCopy = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
  config: AddToGroupConfig,
): Promise<boolean> => {
  try {
    // Get the group conversation
    const group = await client.conversations.getConversationById(
      config.groupId,
    );

    if (!group) {
      console.debug(`Group not found in the db: ${config.groupId}`);
      const errorMessage =
        config.messages.groupNotFound ||
        "Group not found in the db, contact the admin";
      await conversation.send(errorMessage);
      return false;
    }

    // Check the message content against the secret code
    if (message.content !== config.groupCode) {
      await conversation.send(config.messages.invalid);
      return false;
    }

    console.debug(`Secret code received, processing group addition`);

    await (group as Group).sync();
    if (
      (await conversation.metadata()).conversationType === "dm" ||
      (await conversation.metadata()).conversationType === "group"
    ) {
      const members = await (group as Group).members();
      const isMember = members.some(
        (member) =>
          member.inboxId.toLowerCase() === message.senderInboxId.toLowerCase(),
      );

      if (!isMember) {
        console.debug(
          `Adding member ${message.senderInboxId} to group ${config.groupId}`,
        );
        await (group as Group).addMembers([message.senderInboxId]);

        // Check if user should be admin
        if (config.adminInboxIds?.includes(message.senderInboxId)) {
          console.debug(
            `Adding admin ${message.senderInboxId} to group ${config.groupId}`,
          );
          await (group as Group).addSuperAdmin(message.senderInboxId);
        }

        // Send success messages with optional delay
        for (const successMessage of config.messages.success) {
          await conversation.send(successMessage);
        }
        return true;
      } else {
        // User is already in group, check if they need admin privileges
        const isAdminFromGroup = (group as Group).isSuperAdmin(
          message.senderInboxId,
        );
        if (
          !isAdminFromGroup &&
          config.adminInboxIds?.includes(message.senderInboxId)
        ) {
          console.debug(
            `Adding admin privileges to ${message.senderInboxId} in group ${config.groupId}`,
          );
          await (group as Group).addSuperAdmin(message.senderInboxId);
        }

        console.debug(
          `Member ${message.senderInboxId} already in group ${config.groupId}`,
        );
        await conversation.send(config.messages.alreadyInGroup);
        return false;
      }
    }

    throw new Error("Group is not a valid Group instance");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing group addition:`, errorMessage);
    await conversation.send(config.messages.error);
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
export const createAddToGroupConfig = (
  groupConfig: {
    groupId: Record<string, string>;
    groupCode: string;
    messages: {
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
