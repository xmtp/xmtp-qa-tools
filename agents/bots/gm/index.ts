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
});

// Handle agent-level unhandled errors
agent.on("unhandledError", (error) => {
  console.error("GM bot fatal error:", error);
  if (error instanceof Error) {
    console.error("Error stack:", error.stack);
  }
  console.error("Exiting process - PM2 will restart");
  process.exit(1);
});

// Handle process-level uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in GM bot:", error);
  console.error("Error stack:", error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection in GM bot:", reason);
  if (reason instanceof Error) {
    console.error("Error stack:", reason.stack);
  }
  process.exit(1);
});

agent.on("text", async (ctx) => {
  //   const messageBody1 = await getMessageBody(
  //     ctx,
  //     "America/Argentina/Buenos_Aires",
  //   );
  //   //await ctx.sendText(messageBody1);
  if (ctx.isDm()) {
    await ctx.sendText("gm from dm");
  } else if (ctx.isGroup() && ctx.message.content.includes("@gm")) {
    await ctx.sendText("gm from group");
  }
});

agent.on("start", async () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
  logDetails(agent).catch(console.error);
  await getSDKVersionInfo(agent, agent.client);

  // TEST: Crash after 30 seconds to test PM2 restart
  setTimeout(() => {
    console.error(
      "💥 TEST CRASH - Exiting after 30 seconds to test PM2 restart",
    );
    process.exit(1);
  }, 30000);
});

await agent.start({});
