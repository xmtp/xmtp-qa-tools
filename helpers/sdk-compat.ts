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
