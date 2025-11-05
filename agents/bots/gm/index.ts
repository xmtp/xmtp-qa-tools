import { APP_VERSION } from "@helpers/client";
import { Agent, getTestUrl } from "@helpers/versions";

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") process.loadEnvFile(".env");

const agent = await Agent.createFromEnv({
  dbPath: (inboxId) =>
    (process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".") +
    `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
  appVersion: APP_VERSION,
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
});

agent.on("text", async (ctx) => {
  if (ctx.isDm()) {
    const messageContent = ctx.message.content;
    const senderAddress = await ctx.getSenderAddress();
    console.log(`Received message: ${messageContent} by ${senderAddress}`);
    await ctx.sendText("gm");
  }
});

agent.on("text", async (ctx) => {
  if (ctx.isGroup() && ctx.message.content.includes("@gm")) {
    const senderAddress = await ctx.getSenderAddress();
    console.log(
      `Received message in group: ${ctx.message.content} by ${senderAddress}`,
    );
    await ctx.sendText("gm");
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
});

await agent.start();
