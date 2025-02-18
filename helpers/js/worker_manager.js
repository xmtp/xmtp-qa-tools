import { Client as Client38 } from "node-sdk-38";
import { Client as Client39 } from "node-sdk-39";
import { Client as Client40 } from "node-sdk-40";
import { Client as Client41 } from "node-sdk-41";
import { Client as Client42 } from "node-sdk-42";
import { createSigner, dbPath, getEncryptionKeyFromHex } from "./client.js";

export class ClientManager {
  constructor(config) {
    this.version = config.version;
    this.updateVersion(config.version);
    this.signer = createSigner(
      process.env[`WALLET_KEY_${config.name.toUpperCase()}`],
    );

    this.encryptionKey = getEncryptionKeyFromHex(
      process.env[`ENCRYPTION_KEY_${config.name.toUpperCase()}`],
    );
    this.env = config.env;
    this.name = config.name;
    this.installationId = config.installationId;
  }

  updateVersion(version) {
    this.version = version;
    if (version === "38") {
      this.clientType = Client38;
    } else if (version === "39") {
      this.clientType = Client39;
    } else if (version === "40") {
      this.clientType = Client40;
    } else if (version === "41") {
      this.clientType = Client41;
    } else if (version === "42") {
      this.clientType = Client42;
    }
  }

  async receiveMessage(expectedMessage) {
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
  async sendMessage(to, message) {
    try {
      await this.client.conversations.sync();
      const conversation = await this.client.conversations.newDm(to);
      await conversation.send(message);
      console.log(
        "message sent: " + message + " to " + to + " version " + this.version,
      );
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  async initialize() {
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
