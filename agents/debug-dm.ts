import { fileURLToPath } from "node:url";
import agents from "@agents/agents";
import { Agent } from "@agents/versions";
import { type DecodedMessage } from "@xmtp/node-sdk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

export interface SendOptions {
  target?: string;
  groupId?: string;
  agent?: string;
  message?: string;
  wait?: boolean;
  timeout?: number;
}

export interface WaitForResponseResult {
  success: boolean;
  sendTime: number;
  responseTime: number;
  responseMessage: DecodedMessage | null;
}

export function registerSendCommand(yargs: any) {
  return yargs.command(
    "send",
    "Send a message to a conversation",
    (y: any) =>
      y
        .option("target", { type: "string", alias: "t" })
        .option("group-id", { type: "string" })
        .option("agent", { type: "string", alias: "a" })
        .option("message", {
          type: "string",
          alias: "m",
          default: "hello world",
        })
        .option("wait", { type: "boolean", default: false })
        .option("timeout", { type: "number", default: 10000 }),
    async (argv: any) => {
      await runSendCommand({
        target: argv.target,
        groupId: argv["group-id"],
        agent: argv.agent,
        message: argv.message,
        wait: argv.wait,
        timeout: argv.timeout,
      });
    },
  );
}

export async function runSendCommand(options: SendOptions): Promise<void> {
  let { target, message } = options;

  if (options.agent) {
    const agent = agents.find(
      (a) => a.name.toLowerCase() === options.agent?.toLowerCase(),
    );
    if (!agent) {
      throw new Error(
        `Agent "${options.agent}" not found. Available: ${agents.map((a) => a.name).join(", ")}`,
      );
    }
    target = agent.address;
    message = message || agent.sendMessage;
    console.log(`🤖 Using agent: ${agent.name} (${agent.address})`);
  }

  if (!target && !options.groupId) {
    throw new Error("Either --target, --agent, or --group-id is required");
  }

  const agent = await Agent.createFromEnv({});
  try {
    if (options.groupId) {
      await agent.client.conversations.sync();
      const group = (await agent.client.conversations.list()).find(
        (c) => c.id === options.groupId,
      );
      if (!group) {
        throw new Error(`Group ${options.groupId} not found`);
      }
      await sendMessage(
        agent,
        group,
        message || "hello world",
        options.wait,
        options.timeout,
      );
    } else if (target) {
      const dm = await agent.createDmWithAddress(target as `0x${string}`);
      await sendMessage(
        agent,
        dm,
        message || "hello world",
        options.wait,
        options.timeout,
      );
    }
  } finally {
    await agent.stop();
  }
}

async function sendMessage(
  agent: Agent,
  conversation: any,
  message: string,
  wait?: boolean,
  timeout?: number,
) {
  if (wait) {
    const result = await waitForResponse({
      client: {
        conversations: {
          streamAllMessages: () =>
            //@ts-expect-error - TODO: fix this
            agent.client.conversations.streamAllMessages(),
        },
        inboxId: agent.client.inboxId,
      },
      conversation: {
        send: (content: string) => conversation.send(content),
      },
      conversationId: conversation.id,
      senderInboxId: agent.client.inboxId,
      timeout: timeout || 10000,
      messageText: message,
    });
    console.log(`✅ Message sent: "${message}"`);
    if (result.responseMessage) {
      const content =
        typeof result.responseMessage.content === "string"
          ? result.responseMessage.content
          : JSON.stringify(result.responseMessage.content);
      console.log(`📬 Response (${result.responseTime}ms): "${content}"`);
    } else {
      console.log(`❌ No response within timeout`);
    }
  } else {
    await conversation.send(message);
    console.log(`✅ Message sent: "${message}"`);
  }
}

export async function waitForResponse(options: {
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
  workerId?: number;
  attempt?: number;
}): Promise<WaitForResponseResult> {
  const {
    client,
    conversation,
    conversationId,
    senderInboxId,
    timeout,
    messageText,
    workerId,
    attempt,
  } = options;

  // Set up stream and start consuming BEFORE sending message to avoid race condition
  const stream = await client.conversations.streamAllMessages();

  const responseStart = performance.now();
  let timeoutId: NodeJS.Timeout | null = null;

  // Start consuming the stream BEFORE sending the message
  const responsePromise = (async () => {
    try {
      for await (const message of stream) {
        // Filter by conversation ID and exclude messages from sender
        if (
          message.conversationId !== conversationId ||
          message.senderInboxId.toLowerCase() === senderInboxId.toLowerCase()
        ) {
          continue;
        }
        return message;
      }
      return null;
    } catch {
      return null;
    }
  })();

  // Small delay to ensure stream is actively listening before sending
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Now send the message - the stream is already being consumed
  const sendStart = performance.now();
  await conversation.send(messageText || `test-${Date.now()}`);
  const sendTime = performance.now() - sendStart;

  if (workerId !== undefined && attempt !== undefined) {
    console.log(
      `📩 ${workerId}: Attempt ${attempt}, Sent in ${sendTime.toFixed(2)}ms`,
    );
  }

  try {
    const timeoutPromise = new Promise<null>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Timeout"));
      }, timeout);
    });

    const received = await Promise.race([responsePromise, timeoutPromise]);
    const responseTime = performance.now() - responseStart;

    if (workerId !== undefined && attempt !== undefined) {
      console.log(
        `✅ ${workerId}: Attempt ${attempt}, Send=${sendTime.toFixed(2)}ms, Response=${responseTime.toFixed(2)}ms`,
      );
    }
    return { success: true, sendTime, responseTime, responseMessage: received };
  } catch {
    if (workerId !== undefined && attempt !== undefined) {
      console.log(
        `⏱️  ${workerId}: Attempt ${attempt}, Timeout after ${timeout}ms`,
      );
    }
    return {
      success: false,
      sendTime,
      responseTime: performance.now() - responseStart,
      responseMessage: null,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName("yarn send")
    .option("target", { type: "string", alias: "t" })
    .option("group-id", { type: "string" })
    .option("agent", { type: "string", alias: "a" })
    .option("message", { type: "string", alias: "m", default: "hello world" })
    .option("wait", { type: "boolean", default: false })
    .option("timeout", { type: "number", default: 10000 })
    .help()
    .parse();

  try {
    await runSendCommand({
      target: argv.target,
      groupId: argv["group-id"],
      agent: argv.agent,
      message: argv.message,
      wait: argv.wait,
      timeout: argv.timeout,
    });
  } finally {
    // Ensure process exits after completion
    process.exit(0);
  }
}

const isMainModule =
  fileURLToPath(import.meta.url) === process.argv[1] ||
  process.argv[1]?.includes("send.ts") ||
  process.argv[1]?.endsWith("send");

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });
}
