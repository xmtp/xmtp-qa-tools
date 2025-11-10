import { APP_VERSION } from "@helpers/client";
import {
  Agent,
  getSDKVersionInfo,
  getTestUrl,
  logDetails,
} from "@helpers/versions";

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") process.loadEnvFile(".env");

function shouldSkipOldMessage(
  messageTimestamp: number,
  startupTimestamp: number,
  skippedCount: { count: number },
  totalConversations: number,
): boolean {
  if (messageTimestamp >= startupTimestamp) {
    return false;
  }

  const ageMs = startupTimestamp - messageTimestamp;
  const ageHours = ageMs / (1000 * 60 * 60);
  const ageDays = ageHours / 24;
  const ageDisplay =
    ageDays >= 1
      ? `${ageDays.toFixed(1)} days`
      : `${ageHours.toFixed(1)} hours`;

  skippedCount.count++;
  console.log(
    `Skipping message because it was sent before startup (${ageDisplay} old, skipped: ${skippedCount.count}) for total conversations: ${totalConversations}`,
  );
  return true;
}

const agent = await Agent.createFromEnv({
  dbPath: (inboxId) =>
    (process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".") +
    `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
  appVersion: APP_VERSION,
});

const startupTimeStamp = new Date().getTime();
const totalConversations = await agent.client.conversations.list();
const skippedMessagesCount = { count: 0 };

agent.on("text", async (ctx) => {
  const messageTimeStamp = ctx.message.sentAt.getTime();
  if (
    shouldSkipOldMessage(
      messageTimeStamp,
      startupTimeStamp,
      skippedMessagesCount,
      totalConversations.length,
    )
  ) {
    return;
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
});

await agent.start();
