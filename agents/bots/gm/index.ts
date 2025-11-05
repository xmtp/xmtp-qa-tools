import { APP_VERSION } from "@helpers/client";
import {
  Agent,
  getSDKVersionInfo,
  getTestUrl,
  logDetails,
} from "@helpers/versions";

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") process.loadEnvFile(".env");

const agent = await Agent.createFromEnv({
  dbPath: (inboxId) =>
    (process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".") +
    `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
  appVersion: APP_VERSION,
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

  // Log SDK version information
  const versionInfo = getSDKVersionInfo(agent, agent.client);
  console.log(`\n📦 SDK Versions:`);
  if (versionInfo.agentSDK) {
    console.log(`  • Agent SDK: ${versionInfo.agentSDK}`);
  }
  if (versionInfo.nodeSDK) {
    console.log(`  • Node SDK: ${versionInfo.nodeSDK}`);
  }
  if (versionInfo.nodeBindings) {
    console.log(`  • Node Bindings: ${versionInfo.nodeBindings}`);
    if (versionInfo.bindingsVersion) {
      console.log(
        `    └─ libxmtp: ${versionInfo.bindingsVersion.branch}@${versionInfo.bindingsVersion.version} (${versionInfo.bindingsVersion.date})`,
      );
    }
  }
  console.log();

  // @ts-expect-error - getTestUrl is not typed correctly
  logDetails(agent.client).catch(console.error);
  // @ts-expect-error - getTestUrl is not typed correctly
  console.log(`🔗${getTestUrl(agent.client)}`);
});

await agent.start();
