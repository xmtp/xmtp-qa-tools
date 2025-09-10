import { getDbPath } from "@helpers/client";
import { Agent, createSigner, createUser, getTestUrl } from "@xmtp/agent-sdk";

// 2. Spin up the agent
const agent = await Agent.create(createSigner(createUser()), {
  env: process.env.XMTP_ENV as "local" | "dev" | "production", // or 'production'
  dbPath: getDbPath(`echo-bot`),
  appVersion: "echo/1.0.0",
});

let count = 0;

agent.on("text", async (ctx) => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);

  count++;
  console.log(`Count: ${count}`);
  await ctx.conversation.send(`echo: ${ctx.message.content}`);
});

// 4. Log when we're ready
agent.on("start", () => {
  console.log(`We are online: ${getTestUrl(agent)}`);
});

await agent.start();
