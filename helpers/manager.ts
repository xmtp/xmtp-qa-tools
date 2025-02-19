import dotenv from "dotenv";
import { Client as Client38 } from "node-sdk-38";
import { Client as Client39 } from "node-sdk-39";
import { Client as Client40 } from "node-sdk-40";
import { Client as Client41 } from "node-sdk-41";
import { Client as Client42, type Signer, type XmtpEnv } from "node-sdk-42";
import { createSigner, dbPath, getEncryptionKeyFromHex } from "./client";

dotenv.config();

export type { XmtpEnv };

export interface TestCase {
  name: string;
  timeout: number;
  environments: XmtpEnv[];
  versions: string[];
  amount: number;
  installationIds: string[];
  describe: string;
  skipVersions: string[];
  skipEnvironments: string[];
  active?: boolean;
}
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
  public version: string;
  public env: XmtpEnv;
  public name: string;
  public installationId: string;

  constructor(config: ClientConfig) {
    this.version = config.version;
    this.updateVersion(config.version);
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

  async createDM(senderAddresses: string): Promise<string> {
    try {
      const dm = await this.client.conversations.newDm(senderAddresses);
      return dm.id;
    } catch (error) {
      console.error("Error creating DM:", error);
      throw error;
    }
  }
  async createGroup(senderAddresses: string[]): Promise<string> {
    try {
      const group = await this.client.conversations.newGroup([]);
      await group.updateName(
        "Test Group" + Math.random().toString(36).substring(2, 15),
      );
      // First add the sender to the group
      for (const sender of senderAddresses) {
        await group.addMembers([sender]);
      }
      await group.addSuperAdmin(senderAddresses[0]);
      return group.id;
    } catch (error) {
      console.error("Error creating group:", error);
      throw error;
    }
  }

  updateVersion(version: string) {
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
  async sendMessage(groupId: string, message: string): Promise<boolean> {
    try {
      await this.client.conversations.sync();
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      await conversation.send(message);

      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }
  async receiveMessage(expectedMessage: string) {
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
  }
}
