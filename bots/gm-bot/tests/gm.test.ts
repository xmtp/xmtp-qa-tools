import fs from "fs/promises";
import { IdentifierKind } from "@xmtp/node-bindings";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { describe, expect, it } from "vitest";
import { createSigner, getEncryptionKeyFromHex } from "../src/helper.js";

dotenv.config();
const testName = "gm";
const { WALLET_KEY, ENCRYPTION_KEY, GM_BOT_ADDRESS, XMTP_ENV, LOGGING_LEVEL } =
  process.env;

if (
  !WALLET_KEY ||
  !ENCRYPTION_KEY ||
  !GM_BOT_ADDRESS ||
  !XMTP_ENV ||
  !LOGGING_LEVEL
) {
  throw new Error("Required environment variables must be set");
}

describe(testName, () => {
  it("gm-bot: should check if bot is alive", async () => {
    const signer = createSigner(WALLET_KEY as `0x${string}`);
    let volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
    // Ensure the volume path directory exists
    try {
      await fs.mkdir(volumePath, { recursive: true });
      console.log(`Ensured directory exists: ${volumePath}`);
    } catch (error) {
      console.error(`Error creating directory ${volumePath}:`, error);
    }
    const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

    const env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv;

    const identifier = await signer.getIdentifier();
    const address = identifier.identifier;
    const dbPath = `${volumePath}/${address}-${env}`;

    const client = await Client.create(signer, encryptionKey, {
      env,
      dbPath,
      loggingLevel: process.env.LOGGING_LEVEL as any,
    });

    const convo = await client.conversations.newDmWithIdentifier({
      identifierKind: IdentifierKind.Ethereum,
      identifier: GM_BOT_ADDRESS,
    });

    await convo.sync();
    const prevMessages = (await convo.messages()).length;

    // Send a simple message
    await convo.send("gm");

    // Wait briefly for response
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const messages = await convo.messages();

    const messagesAfter = messages.length;

    // We should have at least 2 messages (our message and bot's response)
    expect(messagesAfter).toBe(prevMessages + 2);
    console.log("Messages before:", prevMessages, "after:", messagesAfter);
  }, 100000);
});
