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

  // Send message - use performance.now() for high precision timing
  const sendStart = performance.now();
  const textToSend = messageText || `test-${Date.now()}`;
  await conversation.send(textToSend);
  const sendTime = performance.now() - sendStart;

  if (workerId !== undefined && attempt !== undefined) {
    console.log(
      `📩 ${workerId}: Attempt ${attempt}, Message sent in ${sendTime.toFixed(2)}ms`,
    );
  }

  // Start timing response after message is sent - use performance.now() for high precision
  const responseStartTime = performance.now();
  let responseTime = 0;
  let responseMessage: DecodedMessage | null = null;

  try {
    const responsePromise = (async () => {
      for await (const message of stream) {
        // Skip if the message is from the sender itself
        if (
          message.senderInboxId.toLowerCase() === senderInboxId.toLowerCase()
        ) {
          continue;
        }

        // Got a response from the destination - use performance.now() for high precision
        responseTime = performance.now() - responseStartTime;
        responseMessage = message;
        return message;
      }
      return null;
    })();

    const receivedMessage = await Promise.race([
      responsePromise,
      // Timeout
      new Promise<null>((_, reject) => {
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
    if (workerId !== undefined && attempt !== undefined) {
      console.log(
        `⏱️  ${workerId}: Attempt ${attempt}, Send=${sendTime}ms, Response timeout after ${timeout}ms`,
      );
    }
    throw error;
  }
}
