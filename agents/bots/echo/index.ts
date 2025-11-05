import { APP_VERSION } from "@helpers/client";
import { Agent, getTestUrl } from "@helpers/versions";

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") process.loadEnvFile(".env");

const agent = await Agent.createFromEnv({
  appVersion: APP_VERSION,
});

let count = 0;

agent.on("text", async (ctx) => {
  console.log(`Waiting for messages...`);

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
  // @ts-expect-error - getTestUrl is not typed correctly
  logDetails(agent.client).catch(console.error);
  // @ts-expect-error - getTestUrl is not typed correctly
  console.log(`🔗${getTestUrl(agent.client)}`);
});

await agent.start();
