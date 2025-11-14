import { APP_VERSION } from "@helpers/client";
import {
  Agent,
  getSDKVersionInfo,
  getTestUrl,
  logDetails,
} from "@helpers/versions";
import {
  logSyncResults,
  shouldSkipOldMessage,
  startUpSync,
  type SyncResult,
} from "../../utils/general";

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") process.loadEnvFile(".env");

const agent = await Agent.createFromEnv({
  dbPath: (inboxId) =>
    (process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".") +
    `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
  appVersion: APP_VERSION,
});

const syncResults: SyncResult = await startUpSync(agent);
const {
  startupTimeStamp,
  skippedMessagesCount,
  totalConversations,
}: SyncResult = syncResults;

agent.on("text", async (ctx) => {
  if (
      shouldSkipOldMessage(
      ctx.message.sentAt.getTime(),
      startupTimeStamp,
      skippedMessagesCount,
      totalConversations.length,
    )
  ) {
    //return;
  }
  if (ctx.isDm()) {
    const messageContent = ctx.message.content;
    const senderAddress = await ctx.getSenderAddress();
    console.log(`Received message: ${messageContent} by ${senderAddress}`);
    await ctx.sendText("gm");
  } else if (ctx.isGroup() && ctx.message.content.includes("@gm"))
    await ctx.sendText("gm");
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
  logDetails(agent.client).catch(console.error);
  getSDKVersionInfo(Agent, agent.client);
  logSyncResults(syncResults);
});

await agent.start();
