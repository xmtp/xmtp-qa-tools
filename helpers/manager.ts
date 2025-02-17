import { Client as Client38 } from "node-sdk-38";
import { Client as Client39 } from "node-sdk-39";
import { Client as Client40 } from "node-sdk-40";
import { Client as Client41 } from "node-sdk-41";
import { Client as Client42, type Signer, type XmtpEnv } from "node-sdk-42";
import { createSigner, dbPath, getEncryptionKeyFromHex } from "./client";

export interface ClientConfig {
  version: string;
  env: XmtpEnv;
  name: string;
  installationId: string;
}

export class ClientManager {
  public client!: Client38 | Client39 | Client40 | Client41 | Client42;
  private clientType!:
    | typeof Client38
    | typeof Client39
    | typeof Client40
    | typeof Client41
    | typeof Client42;
  private encryptionKey: Uint8Array;
  private signer: Signer;
  private env: XmtpEnv;
  private name: string;
  private installationId: string;

  constructor(config: ClientConfig) {
    if (config.version === "38") {
      this.clientType = Client38;
    } else if (config.version === "39") {
      this.clientType = Client39;
    } else if (config.version === "40") {
      this.clientType = Client40;
    } else if (config.version === "41") {
      this.clientType = Client41;
    } else if (config.version === "42") {
      this.clientType = Client42;
    }

    this.signer = createSigner(
      process.env[`WALLET_KEY_${config.name.toUpperCase()}`] as `0x${string}`,
    );

    this.encryptionKey = getEncryptionKeyFromHex(
      process.env[`ENCRYPTION_KEY_${config.name.toUpperCase()}`] as string,
    );
    this.env = config.env;
    this.name = config.name;
    this.installationId = config.installationId;
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      await this.client.conversations.sync();
      const conversation = await this.client.conversations.newDm(to);
      await conversation.send(message);
      console.log("message sent");
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  async waitForReply(expectedMessage: string): Promise<boolean> {
    try {
      await this.client.conversations.sync();
      const stream = await this.client.conversations.streamAllMessages();

      for await (const message of stream) {
        if (
          message?.senderInboxId.toLowerCase() ===
            this.client.inboxId.toLowerCase() ||
          message?.contentType?.typeId !== "text"
        ) {
          continue;
        }
        if (message.content === expectedMessage) {
          console.log("message received", expectedMessage);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error("Error waiting for reply:", error);
      throw error;
    }
  }
  async initialize(): Promise<void> {
    const env = this.env;
    this.client = await this.clientType.create(
      this.signer,
      this.encryptionKey,
      {
        env,
        dbPath: dbPath(this.name, this.installationId, env),
      },
    );

    await this.client.conversations.sync();

    console.log(
      `Created client for ${this.name} on the '${this.env}' network...`,
    );
  }
}
