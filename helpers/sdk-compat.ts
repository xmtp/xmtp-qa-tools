/**
 * SDK Compatibility Layer
 *
 * This module provides backward compatibility between SDK 4.x and 5.0.0+
 *
 * Key changes in SDK 5.0.0:
 * - send() now requires EncodedContent instead of accepting string
 * - New helper methods: sendText(), sendMarkdown(), sendReaction(), etc.
 * - Stream callbacks now receive Message | DecodedMessage instead of just DecodedMessage
 */

import type {
  AnyClient,
  AnyConversation,
  AnyGroup,
  ConsentState,
} from "@helpers/versions";
import type {
  Client as Client43,
  Conversation as Conversation43,
} from "@xmtp/node-sdk-4.3.0";
import type {
  Client as Client511,
  Conversation as Conversation511,
} from "@xmtp/node-sdk-5.1.1";

/**
 * Send a text message to a conversation, compatible with both SDK 4.x and 5.0+
 * SDK 5.0+ uses sendText(), while SDK 4.x uses send()
 */
export const sendTextCompat = async (
  conversation: any,
  text: string,
): Promise<unknown> => {
  // Use sendText() for SDK 5.0.0+, fall back to send() for older versions
  if (typeof conversation.sendText === "function") {
    return await conversation.sendText(text);
  } else if (typeof conversation.send === "function") {
    return await conversation.send(text);
  }
  throw new Error("Conversation does not have send or sendText method");
};

/**
 * Check if a message is a DecodedMessage (has contentType property)
 * In SDK 5.0.0+, streams can return Message | DecodedMessage
 */
export const isDecodedMessage = (
  message: any,
): message is {
  contentType: any;
  conversationId: string;
  sentAt: Date;
  senderInboxId: string;
  content: any;
} => {
  return (
    message &&
    typeof message === "object" &&
    "contentType" in message &&
    "conversationId" in message &&
    "sentAt" in message &&
    "senderInboxId" in message &&
    "content" in message
  );
};

/**
 * Ensure a message is decoded
 * In SDK 5.0.0+, some callbacks receive Message | DecodedMessage
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const ensureDecodedMessage = (message: any, _client?: any): any => {
  if (isDecodedMessage(message)) {
    return message;
  }
  // If it's a raw Message, we need to decode it
  // This might not be needed in practice, but provides safety
  throw new Error("Message is not decoded");
};

/**
 * Create a group - uses createGroup() or falls back to newGroup()
 */
export async function createGroupCompat(
  client: AnyClient,
  inboxIds: string[],
  options?: { groupName?: string },
): Promise<AnyGroup> {
  if ("createGroup" in client.conversations) {
    return (client as Client511).conversations.createGroup(inboxIds, options);
  }
  return (client as Client43).conversations.newGroup(inboxIds, options);
}

/**
 * Create a DM - uses createDm() or falls back to newDm()
 */
export async function createDmCompat(
  client: AnyClient,
  inboxId: string,
): Promise<AnyConversation> {
  if ("createDm" in client.conversations) {
    return (client as Client511).conversations.createDm(inboxId);
  }
  return (client as Client43).conversations.newDm(inboxId);
}

/**
 * Fetch inbox state - uses fetchInboxState() or falls back to inboxState(true)
 */
export async function fetchInboxStateCompat(client: AnyClient) {
  if ("fetchInboxState" in client.preferences) {
    return (client as Client511).preferences.fetchInboxState();
  }
  return (client as Client43).preferences.inboxState(true);
}

/**
 * Fetch inbox states for multiple inboxIds - uses fetchInboxStates() or falls back to inboxStateFromInboxIds()
 */
export async function fetchInboxStatesCompat(
  client: AnyClient,
  inboxIds: string[],
) {
  if ("fetchInboxStates" in client.preferences) {
    return (client as Client511).preferences.fetchInboxStates(inboxIds);
  }
  return (client as Client43).preferences.inboxStateFromInboxIds(
    inboxIds,
    true,
  );
}

/**
 * Fetch key package statuses - uses fetchKeyPackageStatuses() or falls back to getKeyPackageStatusesForInstallationIds()
 */
export async function fetchKeyPackageStatusesCompat(
  client: AnyClient,
  installationIds: string[],
): Promise<Record<string, unknown>> {
  if ("fetchKeyPackageStatuses" in client) {
    return (client as Client511).fetchKeyPackageStatuses(installationIds);
  }
  return (client as Client43).getKeyPackageStatusesForInstallationIds(
    installationIds,
  );
}

/**
 * Get consent state - handles method vs property difference between SDK versions
 * Uses cast through unknown because ConsentState enums from different SDK
 * binding packages are structurally identical but nominally distinct.
 */
export function getConsentStateCompat(
  conversation: AnyConversation | AnyGroup,
): ConsentState {
  if (typeof (conversation as Conversation511).consentState === "function") {
    return (conversation as Conversation511).consentState();
  }
  return (conversation as Conversation43)
    .consentState as unknown as ConsentState;
}
