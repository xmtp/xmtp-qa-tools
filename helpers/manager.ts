import dotenv from "dotenv";
import { Client as Client41 } from "node-sdk-41";
import { Client as Client42, type Signer, type XmtpEnv } from "node-sdk-42";
import { createSigner, dbPath, getEncryptionKeyFromHex } from "./client";

/* We dont use logs here, everything is measure in worker file
This way i can measure the time it takes to do the action and not the time it takes to log
And leave this file clean and simple */
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
  public client!: Client42 | Client41;
  private clientType!: typeof Client42 | typeof Client41;
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

    this.env = config.env;
    this.name = config.name;
    this.installationId = config.installationId;
  }

  updateVersion(version: string) {
    this.version = version;
    if (version === "41") {
      this.clientType = Client41;
    } else if (version === "42") {
      this.clientType = Client42;
    }
  }
  async newDM(senderAddresses: string): Promise<string> {
    try {
      const dm = await this.client.conversations.newDm(senderAddresses);
      return dm.id;
    } catch (error) {
      console.error(
        "error:newDM()",
        error instanceof Error ? error.message : String(error),
      );
      return "";
    }
  }
  async newGroup(senderAddresses: string[]): Promise<string> {
    try {
      const group = await this.client.conversations.newGroup(senderAddresses);
      await group.updateName(
        "Test Group" + Math.random().toString(36).substring(2, 15),
      );
      await group.addSuperAdmin(senderAddresses[0]);
      return group.id;
    } catch (error) {
      console.error(
        "error:newGroup()",
        error instanceof Error ? error.message : String(error),
      );
      return "";
    }
  }

  async send(groupId: string, message: string): Promise<boolean> {
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
      console.error(
        "error:send()",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  async updateName(groupId: string, newGroupName: string) {
    try {
      await this.client.conversations.sync();
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      await conversation.sync();
      await conversation.updateName(newGroupName);
      return conversation.name;
    } catch (error) {
      console.error(
        "error:updateName()",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }
  async getMembers(groupId: string) {
    try {
      console.time(`[${this.name}] getMembersFromConversation`);
      await this.client.conversations.sync();
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      await conversation.sync();
      const members = [];
      for (const member of await conversation.members()) {
        members.push(member.accountAddresses);
      }
      console.timeEnd(`[${this.name}] getMembersFromConversation`);
      return members;
    } catch (error) {
      console.error(
        "error:getMembers()",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }
  async removeMembers(groupId: string, memberAddresses: string[]) {
    try {
      await this.client.conversations.sync();
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      await conversation.removeMembers(memberAddresses);
      await conversation.sync();
      return (await conversation.members()).length;
    } catch (error) {
      console.error(
        "error:removeMembers()",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }
  async addMembers(groupId: string, memberAddresses: string[]) {
    try {
      await this.client.conversations.sync();
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      await conversation.addMembers(memberAddresses);
      await conversation.sync();
      return (await conversation.members()).length;
    } catch (error) {
      console.error(
        "error:addMembers()",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }
  async receiveMetadata(groupId: string, expectedMetadata: string) {
    try {
      console.log(
        "[TEST] Receiving metadata for group:",
        groupId,
        expectedMetadata,
      );
      await this.client.conversations.sync();
      const conversation =
        this.client.conversations.getConversationById(groupId);

      if (!conversation) {
        throw new Error("Conversation not found");
      }
      await conversation.sync();
      if (conversation.name === expectedMetadata) {
        return conversation.name;
      }
      return false;
    } catch (error) {
      console.error(
        "error:receiveMetadata()",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }
  async receiveMessage(groupId: string, expectedMessage: string) {
    try {
      await this.client.conversations.sync();
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      // Start the stream before sending the message to ensure delivery
      const stream = conversation.stream();
      for await (const message of stream) {
        if (
          message?.senderInboxId.toLowerCase() ===
            this.client.inboxId.toLowerCase() ||
          message?.contentType?.typeId !== "text"
        ) {
          continue;
        }
        if (message.content === expectedMessage) {
          return expectedMessage;
        }
      }
      return false;
    } catch (error) {
      console.error(
        "error:receiveMessage()",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }
  async initialize(): Promise<void> {
    try {
      this.client = await this.clientType.create(
        this.signer,
        this.encryptionKey,
        {
          env: this.env,
          dbPath: dbPath(this.name, this.installationId, this.env),
        },
      );
      return;
    } catch (error) {
      console.error(
        "error:initialize()",
        error instanceof Error ? error.message : String(error),
      );
      return;
    }
  }
}
