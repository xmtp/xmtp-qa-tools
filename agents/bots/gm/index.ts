import { getMessageBody } from "@agents/helper";
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
  const messageBody1 = await getMessageBody(ctx);
  if (ctx.isDm()) {
    await ctx.sendText(messageBody1);
  } else if (ctx.isGroup() && ctx.message.content.includes("@gm")) {
    await ctx.sendText(messageBody1);
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
  logDetails(agent.client).catch(console.error);
  getSDKVersionInfo(agent, agent.client);
});

await agent.start();
