import { Agent, getTestUrl, logDetails } from "@agents/versions";
import { APP_VERSION } from "@helpers/client";
import { getSDKVersionInfo } from "@helpers/versions";
import { loadEnvFile } from "../../utils/general";

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") loadEnvFile(import.meta.url);

// Immediate log with flush to show restart
console.log(`[RESTART] ========================================`);
console.log(`[RESTART] GM bot process starting at ${new Date().toISOString()}`);
console.log(`[RESTART] ========================================`);
process.stdout.write(""); // Force flush

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
  console.log(
    `[MESSAGE] Received text message: ${ctx.message.content.substring(0, 50)}...`,
  );
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
  const startTime = Date.now();
  console.log(`[START EVENT] ========================================`);
  console.log(
    `[START EVENT] Agent 'start' event fired at ${new Date().toISOString()}`,
  );
  console.log(`[START EVENT] ========================================`);
  process.stdout.write(""); // Force flush
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
  logDetails(agent).catch(console.error);
  await getSDKVersionInfo(agent, agent.client);
  console.log(`[READY] Agent fully initialized and ready`);
  process.stdout.write(""); // Force flush

  // Periodic heartbeat to show agent is running after restart
  const heartbeatInterval = setInterval(() => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    console.log(`[HEARTBEAT] Agent running - uptime: ${uptime}s`);
  }, 5000);

  // TEST: Crash after 30 seconds to test PM2 restart
  setTimeout(() => {
    clearInterval(heartbeatInterval);
    console.error(
      "💥 TEST CRASH - Exiting after 30 seconds to test PM2 restart",
    );
    process.stdout.write(""); // Force flush before exit
    process.exit(1);
  }, 30000);
});

console.log(`[INIT] Starting agent...`);
await agent.start({});
console.log(`[INIT] Agent started, waiting for 'start' event...`);
process.stdout.write(""); // Force flush
