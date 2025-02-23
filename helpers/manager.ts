import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { createSigner, getEncryptionKeyFromHex } from "./client";
import type { Persona } from "./personas";

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

export class ClientManager {
  public client!: Client;
  public version: string;
  public env: string;
  public name: string;
  public installationId: string;
  public walletKey: string;
  private encryptionKey: string;
  private nameId: string;
  public dbPath: string;

  constructor(config: Persona) {
    this.version = config.version;
    this.nameId = `manager:${config.name}-${config.installationId}`;
    this.walletKey = config.walletKey;
    this.encryptionKey = config.encryptionKey;
    this.env = config.env;
    this.name = config.name;
    this.installationId = config.installationId;
    this.dbPath = config.dbPath;
  }

  async initialize(): Promise<void> {
    try {
      console.time(`[${this.nameId}] - initialize`);
      const signer = createSigner(this.walletKey as `0x${string}`);
      const encryptionKey = getEncryptionKeyFromHex(this.encryptionKey);

      this.client = await Client.create(signer, encryptionKey, {
        env: this.env as XmtpEnv,
        dbPath: this.dbPath,
        // eslint-disable-next-line
        loggingLevel: "error" as any,
      });
      console.timeEnd(`[${this.nameId}] - initialize`);
    } catch (error) {
      console.error(
        "error:initialize()",
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        error instanceof Error ? error.message : "Client initialization failed",
      );
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
          return message.content as string;
        }
      }
      return false;
    } catch (error) {
      console.error("Error waiting for reply:", error);
      throw error;
    }
  }
  async newDM(senderAddresses: string): Promise<string> {
    try {
      console.time(`[${this.nameId}] - create DM`);
      const dm = await this.client.conversations.newDm(senderAddresses);
      console.timeEnd(`[${this.nameId}] - create DM`);
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
}
