import { type DecodedMessage } from "@helpers/versions";

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  /** Agent name */
  name: string;
  /** Ethereum address */
  address: string;
  /** Message to send for testing */
  sendMessage: string;
  /** Expected response messages (optional) */
  expectedMessage?: string[];
  /** Networks the agent supports */
  networks: string[];
  /**  the agent is production */
  live: boolean;
}

/**
 * Options for waitForResponse function
 */
export interface WaitForResponseOptions {
  client: {
    conversations: {
      streamAllMessages: () => Promise<AsyncIterable<DecodedMessage>>;
    };
    inboxId: string;
  };
  conversation: {
    send: (content: string) => Promise<string>;
  };
  conversationId: string;
  senderInboxId: string;
  timeout: number;
  messageText?: string;
  attempt?: number;
  messageFilter?: (message: DecodedMessage) => boolean;
}

/**
 * Result from waitForResponse function
 */
export interface WaitForResponseResult {
  success: boolean;
  sendTime: number;
  responseTime: number;
  responseMessage: DecodedMessage | null;
}

/**
 * Send a message and wait for a response from the conversation
 */
export async function waitForResponse(
  options: WaitForResponseOptions,
): Promise<WaitForResponseResult> {
  const {
    client,
    conversation,
    conversationId,
    senderInboxId,
    timeout,
    messageText,
    attempt,
    messageFilter,
  } = options;

  // Set up stream and start consuming BEFORE sending message to avoid race condition
  const stream = await client.conversations.streamAllMessages();
  
  const responseStartTime = performance.now();
  let responseTime = 0;
  let responseMessage: DecodedMessage | null = null;

  // Start consuming the stream BEFORE sending the message
  const responsePromise = (async () => {
    for await (const message of stream) {
      console.log(
        "incoming message",
        message.conversationId,
        conversationId,
        message.senderInboxId,
        senderInboxId,
      );
      // Filter by conversation ID and exclude messages from sender
      if (
        message.conversationId !== conversationId ||
        message.senderInboxId.toLowerCase() === senderInboxId.toLowerCase()
      ) {
        console.log(
          "message filtered by conversation id or sender inbox id",
          message.conversationId,
          conversationId,
          message.senderInboxId,
          senderInboxId,
        );
        continue;
      }
      console.log(
        "incoming message",
        JSON.stringify(message.content, null, 2),
      );
      // Apply custom message filter if provided
      if (messageFilter && !messageFilter(message)) {
        console.log(
          "message filtered",
          message.conversationId,
          conversationId,
        );
        continue;
      }
      responseTime = performance.now() - responseStartTime;
      responseMessage = message;
      return message;
    }
    return null;
  })();

  // Now send the message - the stream is already being consumed
  const sendStart = performance.now();
  const textToSend = messageText || `test-${Date.now()}`;
  await conversation.send(textToSend);
  const sendTime = performance.now() - sendStart;

  console.log(
    `✅  Message sent in ${sendTime.toFixed(2)}ms from ${senderInboxId} to ${conversationId}`,
  );

  try {

    const receivedMessage = await Promise.race([
      responsePromise,
      new Promise<null>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Response timeout"));
        }, timeout);
      }),
    ]);

    if (attempt !== undefined) {
      const totalTime = sendTime + responseTime;
      console.log(
        `✅ Attempt ${attempt}, Send=${sendTime}ms (${(sendTime / 1000).toFixed(2)}s), Response=${responseTime}ms (${(responseTime / 1000).toFixed(2)}s), Total=${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`,
      );

      if (receivedMessage) {
        const messageContent =
          typeof receivedMessage.content === "string"
            ? receivedMessage.content
            : JSON.stringify(receivedMessage.content);
        const preview = messageContent.substring(0, 100);
        console.log(
          `   📬 Response: "${preview}${messageContent.length > 100 ? "..." : ""}"`,
        );
      }
    }

    return {
      success: true,
      sendTime,
      responseTime,
      responseMessage,
    };
  } catch (error) {
    console.log(
      `⏱️  Attempt ${attempt}, Send=${sendTime}ms, Response timeout after ${timeout}ms`,
    );
    throw error;
  }
}
