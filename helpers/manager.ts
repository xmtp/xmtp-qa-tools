import dotenv from "dotenv";
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
}
export interface ClientConfig {
  version: string;
  env: XmtpEnv;
  name: string;
  installationId: string;
  walletKey?: string;
  encryptionKey?: string;
}

export class ClientManager {
  public client!: Client41 | Client42;
  private clientType!: typeof Client41 | typeof Client42;
  private signer: Signer;
  public version: string;
  public env: XmtpEnv;
  public name: string;
  public installationId: string;
  public walletKey!: string;
  private encryptionKey!: Uint8Array;

  constructor(config: ClientConfig) {
    this.version = config.version;
    this.updateVersion(config.version);
    /* Wallet key*/
    const walletKey =
      config.walletKey ??
      (process.env[`WALLET_KEY_${config.name.toUpperCase()}`] as `0x${string}`);

    this.walletKey = walletKey;
    this.signer = createSigner(walletKey as `0x${string}`);
    /* Encryption key*/
    const encryptionKey =
      config.encryptionKey ??
      process.env[`ENCRYPTION_KEY_${config.name.toUpperCase()}`];

    this.encryptionKey = getEncryptionKeyFromHex(encryptionKey as string);
    /* Environment*/
    this.env = config.env;
    /* Name*/
    this.name = config.name;
    /* Installation ID*/
    this.installationId = config.installationId;
  }

  async createDM(senderAddresses: string): Promise<string> {
    try {
      //console.time("Manager:createDM");
      const dm = await this.client.conversations.newDm(senderAddresses);
      //console.timeEnd("Manager:createDM");
      return dm.id;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return "";
    }
  }
  async createGroup(senderAddresses: string[]): Promise<string> {
    try {
      //console.time("Manager:createGroup");
      const group = await this.client.conversations.newGroup(senderAddresses);
      //console.timeEnd("Manager:createGroup");
      //console.time("Manager:updateName");
      await group.updateName(
        "Test Group" + Math.random().toString(36).substring(2, 15),
      );
      //console.timeEnd("Manager:UpdateName");
      //console.time("Manager:AddSuperAdmin");
      await group.addSuperAdmin(senderAddresses[0]);
      //console.timeEnd("Manager:AddSuperAdmin");
      return group.id;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return "";
    }
  }

  updateVersion(version: string) {
    this.version = version;
    if (version === "41") {
      this.clientType = Client41;
    } else if (version === "42") {
      this.clientType = Client42;
    }
  }
  async sendMessage(groupId: string, message: string): Promise<boolean> {
    try {
      //console.time("Manager:sync");
      await this.client.conversations.sync();
      //console.timeEnd("Manager:sync");
      //console.time("Manager:sendMessage");
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      await conversation.send(message);
      //console.timeEnd("Manager:sendMessage");
      return true;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return false;
    }
  }
  async receiveMessage(groupId: string, expectedMessage: string) {
    try {
      //console.time("Manager:sync");
      await this.client.conversations.sync();
      //console.timeEnd("Manager:sync");
      //console.time("Manager:streamAllMessages");
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      const stream = await conversation.streamAllMessages();
      for await (const message of stream) {
        if (
          message?.senderInboxId?.toLowerCase() ===
            this.client.inboxId.toLowerCase() ||
          message?.contentType?.typeId !== "text"
        ) {
          continue;
        }
        if (message.content === expectedMessage) {
          return true;
        }
      }
      //console.timeEnd("Manager:streamAllMessages");
      return false;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return false;
    }
  }
  async initialize(): Promise<void> {
    try {
      //console.time("Manager:initialize");
      this.client = await this.clientType.create(
        this.signer,
        this.encryptionKey,
        {
          env: this.env,
          dbPath: dbPath(this.name, this.installationId, this.env),
        },
      );
      //console.timeEnd("Manager:initialize");
      return;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return;
    }
  }
}
