import { type XmtpEnv } from "@xmtp/node-sdk";
import { getXmtpClient } from "../helpers/client";
import { ReflectTestSuite } from "../helpers/reflect";
import { streamMessages } from "../helpers/xmtp";

const reflectTestSuite = new ReflectTestSuite();

const env: XmtpEnv = "dev";

async function main() {
  console.log("Syncing conversations...");
  const client = await getXmtpClient("bob", env);

  console.log(
    `Agent initialized on ${client.accountAddress}\nSend a message on http://xmtp.chat/dm/${client.accountAddress}?env=${env}`,
  );

  // Start the message listener in the background.
  streamMessages(client).catch(console.error);

  // Run the GM test and wait for its execution ID.
  const { executionId } = await reflectTestSuite.runSendingGmTest();

  if (executionId) {
    await reflectTestSuite.pollExecutionStatus(reflectTestSuite, executionId);
  }
}

main().catch(console.error);
