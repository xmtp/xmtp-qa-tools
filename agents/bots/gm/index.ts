import { Agent, getTestUrl, logDetails } from "@agents/versions";
import { APP_VERSION } from "@helpers/client";
import { getSDKVersionInfo } from "@helpers/versions";
import { getDbPathBase, loadEnvFile } from "../../utils/general";

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") loadEnvFile(import.meta.url);

const agent = await Agent.createFromEnv({
  dbPath: (inboxId) =>
    getDbPathBase() + `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
  appVersion: APP_VERSION,
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
});

await agent.start({});
