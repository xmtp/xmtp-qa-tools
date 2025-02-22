import dotenv from "dotenv";
import { Client as Client42, type Signer, type XmtpEnv } from "node-sdk-42";
import { createSigner, getEncryptionKeyFromHex } from "./client";

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
  dbPath: string;
}

export class ClientManager {
  public client!: Client42;
  private clientType!: typeof Client42;
  private signer: Signer;
  public version: string;
  public env: XmtpEnv;
  public name: string;
  public installationId: string;
  public walletKey!: string;
  private encryptionKey!: Uint8Array;
  private nameId!: string;
  public dbPath: string;

  constructor(config: ClientConfig) {
    this.version = config.version;
    this.nameId = `manager:${config.name}-${config.installationId}`;
    this.updateVersion(config.version);
    /* Wallet key*/
    const walletKey =
      config.walletKey ??
      (process.env[`WALLET_KEY_${config.name.toUpperCase()}`] as `0x${string}`);
    this.clientType = Client42;
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
    this.dbPath = config.dbPath;
    console.log("dbPath", this.dbPath);
  }

  updateVersion(version: string) {
    this.version = version;
    if (version === "42") {
      this.clientType = Client42;
    }
  }
  async receiveMessage(groupId: string, expectedMessages: string[]) {
    try {
      console.log(`[${this.nameId}] - started stream`);
      console.time(`[${this.nameId}] - sync`);
      await this.client.conversations.syncAll();
      console.timeEnd(`[${this.nameId}] - sync`);
      console.log(`[${this.nameId}] - synced`);
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      console.log(`[${this.nameId}] - syncing conversation`);
      console.time(`[${this.nameId}] - sync conversation`);
      await conversation.sync();
      console.timeEnd(`[${this.nameId}] - sync`);
      console.log(`[${this.nameId}] - synced`);
      const stream = conversation.stream();
      const receivedMessages: string[] = [];
      console.log(`[${this.nameId}] - receiving messages`);
      for await (const message of stream) {
        console.info(`[${this.nameId}] - received message`);
        if (
          message?.senderInboxId.toLowerCase() ===
            this.client.inboxId.toLowerCase() ||
          message?.contentType?.typeId !== "text"
        ) {
          continue;
        }
        const content = message.content as string;
        if (expectedMessages.includes(content)) {
          if (!receivedMessages.includes(content)) {
            receivedMessages.push(content);
          }
        }
        console.log(
          `[${this.nameId}] - received ${receivedMessages.length} messages`,
        );
        if (receivedMessages.length === expectedMessages.length) {
          break;
        }
      }
      return receivedMessages;
    } catch (error) {
      console.error(
        "error:receiveMessage()",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }
  async newDM(senderAddresses: string): Promise<string> {
    try {
      console.log(`[${this.nameId}] - creating DM`);
      console.time(`[${this.nameId}] - create DM`);
      const dm = await this.client.conversations.newDm(senderAddresses);
      console.timeEnd(`[${this.nameId}] - create DM`);
      console.log(`[${this.nameId}] - DM created`);
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
      console.log(`[${this.nameId}] - creating group`);
      console.time(`[${this.nameId}] - create group`);
      const group = await this.client.conversations.newGroup(senderAddresses);
      console.timeEnd(`[${this.nameId}] - create group`);
      console.log(`[${this.nameId}] - group created`);
      console.log(`[${this.nameId}] - updating group name`);
      console.time(`[${this.nameId}] - update group name`);
      await group.updateName(
        "Test Group" + Math.random().toString(36).substring(2, 15),
      );
      console.timeEnd(`[${this.nameId}] - update group name`);
      console.log(`[${this.nameId}] - adding super admin`);
      console.time(`[${this.nameId}] - add super admin`);
      await group.addSuperAdmin(senderAddresses[0]);
      console.timeEnd(`[${this.nameId}] - add super admin`);
      console.log(`[${this.nameId}] - super admin added`);
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
      console.log(`[${this.nameId}] - syncing`);
      console.time(`[${this.nameId}] - sync`);
      await this.client.conversations.sync();
      console.timeEnd(`[${this.nameId}] - sync`);
      console.log(`[${this.nameId}] - synced`);
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      console.log(`[${this.nameId}] - sending message`);
      console.time(`[${this.nameId}] - send`);
      await conversation.send(message);
      console.timeEnd(`[${this.nameId}] - send`);
      console.log(`[${this.nameId}] - message sent`);
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
      console.log(`[${this.nameId}] - syncing`);
      console.time(`[${this.nameId}] - sync`);
      await this.client.conversations.sync();
      console.timeEnd(`[${this.nameId}] - sync`);
      console.log(`[${this.nameId}] - synced`);
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      console.log(`[${this.nameId}] - syncing conversation`);
      console.time(`[${this.nameId}] - sync conversation`);
      await conversation.sync();
      console.timeEnd(`[${this.nameId}] - sync conversation`);
      console.log(`[${this.nameId}] - synced conversation`);
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
  async isMember(groupId: string, memberAddress: string) {
    try {
      console.log(`[${this.nameId}] - syncing`);
      console.time(`[${this.nameId}] - sync`);
      await this.client.conversations.sync();
      console.timeEnd(`[${this.nameId}] - sync`);
      console.log(`[${this.nameId}] - synced`);
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      console.log(`[${this.nameId}] - syncing conversation`);
      console.time(`[${this.nameId}] - sync conversation`);
      await conversation.sync();
      console.timeEnd(`[${this.nameId}] - sync conversation`);
      console.log(`[${this.nameId}] - synced conversation`);
      const members = await conversation.members();
      return members.some((member) =>
        member.accountAddresses.some(
          (address) => address.toLowerCase() === memberAddress.toLowerCase(),
        ),
      );
    } catch (error) {
      console.error(
        "error:isMember()",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }
  async messages(groupId: string): Promise<string[]> {
    try {
      console.log(`[${this.nameId}] - syncing`);
      console.time(`[${this.nameId}] - sync`);
      await this.client.conversations.sync();
      console.timeEnd(`[${this.nameId}] - sync`);
      console.log(`[${this.nameId}] - synced`);
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      console.log(`[${this.nameId}] - syncing conversation`);
      console.time(`[${this.nameId}] - sync conversation`);
      await conversation.sync();
      console.timeEnd(`[${this.nameId}] - sync conversation`);
      console.log(`[${this.nameId}] - synced conversation`);
      const returnedMessages: string[] = [];
      const messages = await conversation.messages();
      for (const message of messages) {
        if (message.contentType?.typeId === "text") {
          returnedMessages.push(message.content as string);
        }
      }
      return returnedMessages;
    } catch (error) {
      console.error(
        "error:messages()",
        error instanceof Error ? error.message : String(error),
      );
      return [];
    }
  }
  async getMembers(groupId: string) {
    try {
      console.log(`[${this.nameId}] - syncing`);
      console.time(`[${this.nameId}] - sync`);
      await this.client.conversations.sync();
      console.timeEnd(`[${this.nameId}] - sync`);
      console.log(`[${this.nameId}] - synced`);
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      console.log(`[${this.nameId}] - syncing conversation`);
      console.time(`[${this.nameId}] - sync conversation`);
      await conversation.sync();
      console.timeEnd(`[${this.nameId}] - sync conversation`);
      console.log(`[${this.nameId}] - synced conversation`);
      const members = [];
      for (const member of await conversation.members()) {
        members.push(member.accountAddresses);
      }
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
      console.log(`[${this.nameId}] - syncing`);
      console.time(`[${this.nameId}] - sync`);
      await this.client.conversations.sync();
      console.timeEnd(`[${this.nameId}] - sync`);
      console.log(`[${this.nameId}] - synced`);
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      console.log(`[${this.nameId}] - removing members`);
      console.time(`[${this.nameId}] - remove members`);
      await conversation.removeMembers(memberAddresses);
      console.timeEnd(`[${this.nameId}] - remove members`);
      console.log(`[${this.nameId}] - members removed`);
      console.log(`[${this.nameId}] - syncing conversation`);
      console.time(`[${this.nameId}] - sync conversation`);
      await conversation.sync();
      console.timeEnd(`[${this.nameId}] - sync conversation`);
      console.log(`[${this.nameId}] - synced conversation`);
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
      console.log(`[${this.nameId}] - syncing`);
      console.time(`[${this.nameId}] - sync`);
      await this.client.conversations.sync();
      console.timeEnd(`[${this.nameId}] - sync`);
      console.log(`[${this.nameId}] - synced`);
      const conversation =
        this.client.conversations.getConversationById(groupId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      console.log(`[${this.nameId}] - adding members`);
      console.time(`[${this.nameId}] - add members`);
      await conversation.addMembers(memberAddresses);
      console.timeEnd(`[${this.nameId}] - add members`);
      console.log(`[${this.nameId}] - members added`);
      console.log(`[${this.nameId}] - syncing conversation`);
      console.time(`[${this.nameId}] - sync conversation`);
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
      console.log(`[${this.nameId}] - syncing`);
      console.time(`[${this.nameId}] - sync`);
      await this.client.conversations.sync();
      console.timeEnd(`[${this.nameId}] - sync`);
      console.log(`[${this.nameId}] - synced`);
      const conversation =
        this.client.conversations.getConversationById(groupId);

      if (!conversation) {
        throw new Error("Conversation not found");
      }
      console.log(`[${this.nameId}] - syncing conversation`);
      console.time(`[${this.nameId}] - sync conversation`);
      await conversation.sync();
      console.timeEnd(`[${this.nameId}] - sync conversation`);
      console.log(`[${this.nameId}] - synced conversation`);
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
  async initialize(): Promise<void> {
    try {
      console.log(`[${this.nameId}] - initializing`);
      console.time(`[${this.nameId}] - initialize`);
      console.log("dbPath", this.dbPath);
      this.client = await this.clientType.create(
        this.signer,
        this.encryptionKey,
        {
          env: this.env,
          dbPath: this.dbPath,
        },
      );
      console.timeEnd(`[${this.nameId}] - initialize`);
      console.log(`[${this.nameId}] - initialized`);
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
