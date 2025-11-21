import type { DecodedMessage } from "@helpers/versions";

export interface WaitForResponseOptions {
  conversation: {
    stream: () => Promise<AsyncIterable<DecodedMessage>>;
    send: (content: string) => Promise<string>;
  };
  senderInboxId: string;
  timeout: number;
  messageText?: string;
  workerId?: number;
  attempt?: number;
}

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
    conversation,
    senderInboxId,
    timeout,
    messageText,
    workerId,
    attempt,
  } = options;

  // Set up message stream before sending
  const stream = await conversation.stream();

  // Send message
  const sendStart = Date.now();
  const textToSend = messageText || `test-${Date.now()}`;
  await conversation.send(textToSend);
  const sendTime = Date.now() - sendStart;

  if (workerId !== undefined && attempt !== undefined) {
    console.log(
      `📩 ${workerId}: Attempt ${attempt}, Message sent in ${sendTime}ms`,
    );
  }

  // Start timing response after message is sent
  const responseStartTime = Date.now();
  let responseTime = 0;
  let responseMessage: DecodedMessage | null = null;

  try {
    await Promise.race([
      // Wait for response from stream
      (async () => {
        for await (const message of stream as AsyncIterable<DecodedMessage>) {
          // Skip if the message is from the sender itself
          if (
            message.senderInboxId.toLowerCase() === senderInboxId.toLowerCase()
          ) {
            continue;
          }

          // Got a response from the destination
          responseTime = Date.now() - responseStartTime;
          responseMessage = message;
          break;
        }
      })(),
      // Timeout
      new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Response timeout"));
        }, timeout);
      }),
    ]);

    // Log detailed response information
    const totalTime = sendTime + responseTime;
    if (workerId !== undefined && attempt !== undefined) {
      console.log(
        `✅ ${workerId}: Attempt ${attempt}, Send=${sendTime}ms (${(sendTime / 1000).toFixed(2)}s), Response=${responseTime}ms (${(responseTime / 1000).toFixed(2)}s), Total=${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`,
      );

      if (responseMessage) {
        const msg = responseMessage as DecodedMessage;
        const messageContent =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);
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
    if (workerId !== undefined && attempt !== undefined) {
      console.log(
        `⏱️  ${workerId}: Attempt ${attempt}, Send=${sendTime}ms, Response timeout after ${timeout}ms`,
      );
    }
    throw error;
  }
}
