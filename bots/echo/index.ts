import { Agent, getTestUrl } from "@xmtp/agent-sdk";

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  appVersion: "echo-agent/0",
});

let count = 0;

agent.on("text", async (ctx) => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);

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
  console.log(`We are online: ${getTestUrl(agent)}`);
});

await agent.start();
