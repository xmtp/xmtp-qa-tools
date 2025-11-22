import { Agent, type DecodedMessage, type Group } from "@helpers/versions";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import "dotenv/config";
import { fileURLToPath } from "url";
import agents from "../agents/monitoring/agents";

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
      ) as Group | undefined;
      if (!group) {
        throw new Error(`Group ${options.groupId} not found`);
      }
      await sendMessage(
        agent,
        group,
        message || "hello world",
        options.wait,
        options.timeout,
        `https://xmtp.chat/conversations/${options.groupId}`,
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
  url?: string,
) {
  if (wait) {
    const result = await waitForResponse({
      conversation: {
        stream: () =>
          conversation.stream() as Promise<AsyncIterable<DecodedMessage>>,
        send: (content: string) => conversation.send(content),
      },
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
      console.log(`⏱️  No response within timeout`);
    }
    if (url) console.log(`🔗 ${url}`);
  } else {
    await conversation.send(message);
    console.log(`✅ Message sent: "${message}"`);
    if (url) console.log(`🔗 ${url}`);
  }
}

export async function waitForResponse(options: {
  conversation: {
    stream: () => Promise<AsyncIterable<DecodedMessage>>;
    send: (content: string) => Promise<string>;
  };
  senderInboxId: string;
  timeout: number;
  messageText?: string;
  workerId?: number;
  attempt?: number;
}): Promise<WaitForResponseResult> {
  const {
    conversation,
    senderInboxId,
    timeout,
    messageText,
    workerId,
    attempt,
  } = options;
  const stream = await conversation.stream();
  const sendStart = performance.now();
  await conversation.send(messageText || `test-${Date.now()}`);
  const sendTime = performance.now() - sendStart;

  if (workerId !== undefined && attempt !== undefined) {
    console.log(
      `📩 ${workerId}: Attempt ${attempt}, Sent in ${sendTime.toFixed(2)}ms`,
    );
  }

  const responseStart = performance.now();
  const iterator = stream[Symbol.asyncIterator]();
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    const responsePromise = (async () => {
      try {
        while (true) {
          const { value, done } = await iterator.next();
          if (done) return null;
          if (
            value?.senderInboxId.toLowerCase() !== senderInboxId.toLowerCase()
          ) {
            return value;
          }
        }
      } catch {
        return null;
      }
    })();

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
    await iterator.return?.().catch(() => {});
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
