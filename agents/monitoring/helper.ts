import { streamTimeout } from "@helpers/client";
import { type XmtpEnv } from "@helpers/versions";
import { type DecodedMessage } from "@xmtp/agent-sdk-1.1.14";
import { expect, it } from "vitest";

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

/**
 * Filter agents by environment and optionally by live status
 */
export function filterAgentsByEnv(
  agents: AgentConfig[],
  env: XmtpEnv,
  liveOnly?: boolean,
): AgentConfig[] {
  return agents.filter((agent) => {
    const matchesEnv = agent.networks.includes(env);
    const matchesLive = liveOnly ? agent.live : true;
    return matchesEnv && matchesLive;
  });
}

/**
 * Handle empty agents case by creating a skipped test
 */
export function handleEmptyAgents(testName: string, env: XmtpEnv): void {
  it(`${testName}: No agents configured for this environment`, () => {
    console.log(`No agents found for env: ${env}`);
    expect(true).toBe(true); // Pass the test
  });
}

/**
 * Format response message content to string
 */
export function formatResponseContent(message: DecodedMessage | null): string {
  if (!message) return "";
  return typeof message.content === "string"
    ? message.content
    : JSON.stringify(message.content);
}

/**
 * Create test message for tagged/command scenarios
 */
export function createTaggedTestMessage(
  agent: AgentConfig,
  sendMessage?: string,
): string {
  const message = sendMessage || agent.sendMessage;
  const isSlashCommand = message.startsWith("/");
  return isSlashCommand ? message : `@${agent.name} ${message}`;
}

/**
 * Calculate response time with fallback to streamTimeout
 */
export function calculateResponseTime(
  averageEventTiming?: number | null,
): number {
  return Math.abs(averageEventTiming ?? streamTimeout);
}
