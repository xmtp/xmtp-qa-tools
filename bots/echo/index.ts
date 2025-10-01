import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { APP_VERSION } from "version-management/client-versions";

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") process.loadEnvFile(".env");

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  appVersion: APP_VERSION,
});

let count = 0;

agent.on("text", async (ctx) => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);

  count++;
  console.log(`Count: ${count}`);
  await ctx.sendText(`echo: ${ctx.message.content}`);
});

// Handle uncaught errors
agent.on("unhandledError", (error) => {
  console.error("Agent error", error);
});

// 4. Log when we're ready
agent.on("start", () => {
  console.log(`We are online: ${getTestUrl(agent.client)}`);
});

await agent.start();
