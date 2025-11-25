import { Agent, getTestUrl, logDetails } from "@agents/versions";
import { APP_VERSION } from "@helpers/client";
import { getSDKVersionInfo } from "@helpers/versions";
import { loadEnvFile } from "../../utils/general";

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") loadEnvFile(import.meta.url);

const agent = await Agent.createFromEnv({
  dbPath: (inboxId) =>
    (process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".") +
    `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
  appVersion: APP_VERSION,
  disableDeviceSync: true,
});

agent.on("text", async (ctx) => {
  if (ctx.isDm()) {
    const messageContent = ctx.message.content;
    const senderAddress = await ctx.getSenderAddress();
    console.log(`Received message: ${messageContent} by ${senderAddress}`);
    await ctx.sendText("gm local " + ctx.conversation.id);
  } else if (ctx.isGroup() && ctx.message.content.includes("@gm"))
    await ctx.sendText("gm local " + ctx.conversation.id);
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
  logDetails(agent.client).catch(console.error);
  getSDKVersionInfo(agent, agent.client);
});

await agent.start();
