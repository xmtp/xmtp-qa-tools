import { Agent, getTestUrl, logDetails } from "@agents/versions";
import { APP_VERSION } from "@helpers/client";
import { getSDKVersionInfo } from "@helpers/versions";
import { getDbPathBase, loadEnvFile } from "../../utils/general";

// Immediate synchronous log - FIRST THING that runs
console.log(
  `[RESTART] GM bot starting - PID: ${process.pid} at ${new Date().toISOString()}`,
);

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") loadEnvFile(import.meta.url);

const agent = await Agent.createFromEnv({
  dbPath: (inboxId) =>
    getDbPathBase() + `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
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

// // Handle process-level uncaught exceptions
// process.on("uncaughtException", (error) => {
//   console.error(`[UNCAUGHT_EXCEPTION] PID: ${process.pid}`, error);
//   process.exit(1);
// });

// // Handle unhandled promise rejections
// process.on("unhandledRejection", (reason) => {
//   console.error(`[UNHANDLED_REJECTION] PID: ${process.pid}`, reason);
//   process.exit(1);
// });

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
  //  const startTime = Date.now();
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
  logDetails(agent).catch(console.error);
  await getSDKVersionInfo(agent, agent.client);

  // Periodic heartbeat to show agent is running after restart
  // const heartbeatInterval = setInterval(() => {
  //   const uptime = Math.floor((Date.now() - startTime) / 1000);
  //   console.log(`[HEARTBEAT] Uptime: ${uptime}s`);
  // }, 5000);

  // TEST: Crash after 1 minute to test PM2 restart
  // setTimeout(() => {
  //   clearInterval(heartbeatInterval);
  //   console.error(`💥 TEST CRASH - Exiting at ${new Date().toISOString()} - PID: ${process.pid}`);
  //   process.exit(1);
  // }, 60000);
});

await agent.start({});
