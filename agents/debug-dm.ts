import { Agent } from "@agents/versions";

process.loadEnvFile(".env");

const MESSAGE = "PING";
const TIMEOUT_SECONDS = 10;
const STREAM_SETUP_DELAY_MS = 500;

async function waitForResponse(
  agent: Agent,
  conversation: any,
  conversationId: string,
  message: string,
) {
  const stream = await agent.client.conversations.streamAllMessages();
  const startTime = performance.now();
  let timeoutId: NodeJS.Timeout | null = null;
  let done = false;

  const responsePromise = (async () => {
    try {
      for await (const msg of stream) {
        if (done) break;
        if (
          msg.conversationId !== conversationId ||
          msg.senderInboxId.toLowerCase() === agent.client.inboxId.toLowerCase()
        ) {
          continue;
        }
        done = true;
        return msg;
      }
      return null;
    } catch {
      return null;
    }
  })();

  await new Promise((resolve) => setTimeout(resolve, STREAM_SETUP_DELAY_MS));

  await conversation.send(message);
  const sendTime = performance.now() - startTime;

  try {
    const timeoutPromise = new Promise<null>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Timeout"));
      }, TIMEOUT_SECONDS * 1000);
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);
    const responseTime = performance.now() - startTime;

    return {
      sendTime,
      responseTime,
      responseMessage: response,
    };
  } catch {
    done = true;
    return {
      sendTime,
      responseTime: performance.now() - startTime,
      responseMessage: null,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    done = true;
  }
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("Error: Target address required");
    process.exit(1);
  }

  const agent = await Agent.createFromEnv({});
  try {
    const dm = await agent.createDmWithAddress(target as `0x${string}`);
    const result = await waitForResponse(agent, dm, dm.id, MESSAGE);

    console.log(`✅ Message sent (${result.sendTime.toFixed(2)}ms)`);
    if (result.responseMessage) {
      const content =
        typeof result.responseMessage.content === "string"
          ? result.responseMessage.content
          : JSON.stringify(result.responseMessage.content);
      console.log(
        `📬 Response (${result.responseTime.toFixed(2)}ms): "${content}"`,
      );
    } else {
      console.log(`❌ No response within ${TIMEOUT_SECONDS}s`);
    }
  } finally {
    await agent.stop();
    process.exit(0);
  }
}

main().catch((error: unknown) => {
  console.error(
    "Error:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
