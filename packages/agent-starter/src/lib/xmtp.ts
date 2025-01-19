import dotenv from "dotenv";
dotenv.config();
import {
  DecodedMessage,
  Client,
  ClientOptions,
  XmtpEnv,
  Conversation,
} from "@xmtp/node-sdk";
import { ContentTypeReply, Reply, ReplyCodec } from "@xmtp/content-type-reply";
import {
  ContentTypeReaction,
  Reaction,
  ReactionCodec,
} from "@xmtp/content-type-reaction";
import { ContentTypeText, TextCodec } from "@xmtp/content-type-text";
import {
  Attachment,
  AttachmentCodec,
  ContentTypeRemoteAttachment,
  RemoteAttachmentCodec,
} from "@xmtp/content-type-remote-attachment";
import {
  ContentTypeReadReceipt,
  ReadReceiptCodec,
} from "@xmtp/content-type-read-receipt";
import {
  AgentMessage,
  AgentMessageCodec,
  ContentTypeAgentMessage,
} from "../content-types/agent-message.js";
import { createWalletClient, http, isAddress, toBytes, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

import { getRandomValues } from "crypto";
import path from "path";
import { Message, agentMessage, UserReturnType, User, Agent } from "./types.js";
import { readFile } from "fs/promises";
import * as fs from "fs";
import fetch from "node-fetch";
import crypto from "crypto";

export async function xmtpClient(agent?: Agent): Promise<XMTP> {
  let xmtp: XMTP | null = null; // Ensure a single instance
  xmtp = new XMTP(agent);
  await xmtp.init();
  return xmtp;
}

export class XMTP {
  client: Client | undefined;
  address: string | undefined;
  inboxId: string | undefined;
  onMessage: (message: Message) => Promise<void>;
  agent?: Agent;

  constructor(agent?: Agent) {
    this.onMessage = agent?.onMessage ?? (() => Promise.resolve());
    this.agent = agent;
  }

  async init(): Promise<XMTP> {
    let fixedKey =
      this.agent?.fixedKey ??
      process.env["FIXED_KEY" + (this.agent?.name ?? "")] ??
      toHex(getRandomValues(new Uint8Array(32)));

    if (!fixedKey.startsWith("0x")) {
      fixedKey = "0x" + fixedKey;
    }
    let encryptionKey =
      this.agent?.encryptionKey ??
      process.env["ENCRYPTION_KEY" + (this.agent?.name ?? "")] ??
      toHex(getRandomValues(new Uint8Array(32)));

    if (!encryptionKey.startsWith("0x")) {
      encryptionKey = "0x" + encryptionKey;
    }

    const user = createUser(encryptionKey);

    let env = this.agent?.config?.env as XmtpEnv;
    if (!env) env = "production" as XmtpEnv;

    let volumePath =
      process.env.RAILWAY_VOLUME_MOUNT_PATH ??
      this.agent?.config?.path ??
      ".data/xmtp";

    if (fs && !fs.existsSync(volumePath)) {
      fs.mkdirSync(volumePath, { recursive: true });
    }

    const defaultConfig: ClientOptions = {
      env: env,
      dbPath: `${volumePath}/${user.account?.address.toLowerCase()}-${env}`,
      codecs: [
        new TextCodec(),
        new ReactionCodec(),
        new ReplyCodec(),
        new RemoteAttachmentCodec(),
        new AttachmentCodec(),
        new ReadReceiptCodec(),
        new AgentMessageCodec(),
      ],
    };

    // Merge the default configuration with the provided config. Repeated fields in clientConfig will override the default values
    const finalConfig = { ...defaultConfig, ...this.agent?.config };

    const client = await Client.create(
      createSigner(user),
      new Uint8Array(toBytes(fixedKey as `0x${string}`)),
      finalConfig,
    );

    this.client = client;
    this.inboxId = client.inboxId;
    this.address = client.accountAddress;
    Promise.all([streamMessages(this.onMessage, client, this)]);
    this.saveKeys(this.agent?.name ?? "", fixedKey, encryptionKey);
    return this;
  }
  saveKeys(agentName: string, fixedKey: string, encryptionKey: string) {
    const envFilePath = path.resolve(process.cwd(), ".env");
    const envContent = `\nFIXED_KEY${agentName}=${fixedKey}\nENCRYPTION_KEY${agentName}=${encryptionKey}`;

    // Read the existing .env file content
    let existingEnvContent = "";
    if (fs.existsSync(envFilePath)) {
      existingEnvContent = fs.readFileSync(envFilePath, "utf8");
    }

    // Check if the keys already exist
    if (
      !existingEnvContent.includes(`FIXED_KEY${agentName}=`) &&
      !existingEnvContent.includes(`ENCRYPTION_KEY${agentName}=`)
    ) {
      fs.appendFileSync(envFilePath, envContent);
    }
  }
  async getAttachment(source: string): Promise<Attachment | undefined> {
    try {
      let imgArray: Uint8Array;
      let mimeType: string;
      let filename: string;

      const MAX_SIZE = 1024 * 1024; // 1MB in bytes

      // Check if source is a URL
      if (source.startsWith("http://") || source.startsWith("https://")) {
        try {
          // Handle URL
          const response = await fetch(source);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          // Check Content-Length header first if available
          const contentLength = response.headers.get("content-length");
          if (contentLength && parseInt(contentLength) > MAX_SIZE) {
            throw new Error("Image size exceeds 1MB limit");
          }

          const arrayBuffer = await response.arrayBuffer();

          // Double check actual size
          if (arrayBuffer.byteLength > MAX_SIZE) {
            throw new Error("Image size exceeds 1MB limit");
          }

          imgArray = new Uint8Array(arrayBuffer);
          mimeType = response.headers.get("content-type") || "image/jpeg";
          filename = source.split("/").pop() || "image";

          // If filename doesn't have an extension, add one based on mime type
          if (!filename.includes(".")) {
            const ext = mimeType.split("/")[1];
            filename = `${filename}.${ext}`;
          }
        } catch (error) {
          console.error("Error fetching image from URL:", error);
          throw error;
        }
      } else {
        // Handle file path
        const file = await readFile(source);
        if (!file) {
          console.error("File operations not supported in this environment");
          return undefined;
        }

        // Check file size
        if (file.length > MAX_SIZE) {
          throw new Error("Image size exceeds 1MB limit");
        }

        filename = path.basename(source);
        const extname = path.extname(source);
        mimeType = `image/${extname.replace(".", "").replace("jpg", "jpeg")}`;
        imgArray = new Uint8Array(file);
      }

      const attachment: Attachment = {
        filename,
        mimeType,
        data: imgArray,
      };
      return attachment;
    } catch (error) {
      console.error("Failed to send image:", error);
      throw error;
    }
  }

  async send(agentMessage: agentMessage) {
    let contentType:
      | typeof ContentTypeReaction
      | typeof ContentTypeText
      | typeof ContentTypeRemoteAttachment
      | typeof ContentTypeAgentMessage
      | typeof ContentTypeReadReceipt
      | typeof ContentTypeReply = ContentTypeText;

    let message: any;
    if (!agentMessage.typeId || agentMessage.typeId === "text") {
      message = agentMessage.message;
      contentType = ContentTypeText;
    } else if (agentMessage.typeId === "attachment") {
      message = (await this.getAttachment(agentMessage.message)) as Attachment;
      contentType = ContentTypeRemoteAttachment;
    } else if (agentMessage.typeId === "reaction") {
      message = {
        content: agentMessage.message,
        action: "added",
        reference: agentMessage.originalMessage?.id,
        schema: "unicode",
      } as Reaction;
      contentType = ContentTypeReaction;
    } else if (agentMessage.typeId === "reply") {
      contentType = ContentTypeReply;
      message = {
        content: agentMessage.message,
        contentType: ContentTypeText,
        reference: agentMessage.originalMessage?.id,
      } as Reply;
    } else if (agentMessage.typeId === "agent_message") {
      message = new AgentMessage(
        agentMessage.message,
        agentMessage.metadata,
      ) as AgentMessage;
      contentType = ContentTypeAgentMessage;
    }
    if (!agentMessage.receivers || agentMessage.receivers.length == 0) {
      agentMessage.receivers = [
        agentMessage.originalMessage?.sender.inboxId as string,
      ];
    }
    for (let receiverAddress of agentMessage.receivers) {
      let inboxId = !isAddress(receiverAddress)
        ? receiverAddress
        : await this.client?.getInboxIdByAddress(receiverAddress);
      if (!inboxId) {
        throw new Error("Invalid receiver address");
      }
      let conversation =
        await this.client?.conversations.getDmByInboxId(inboxId);
      if (!conversation) {
        conversation = await this.client?.conversations.newDm(receiverAddress);
      }
      return conversation?.send(message, contentType);
    }
  }

  async getConversationFromMessage(
    message: DecodedMessage | null | undefined,
  ): Promise<Conversation | null | undefined> {
    return await this.client?.conversations.getConversationById(
      (message as DecodedMessage)?.conversationId as string,
    );
  }

  isConversation(conversation: Conversation): conversation is Conversation {
    return conversation?.id !== undefined;
  }

  getConversationKey(message: Message) {
    return `${message?.group?.id}`;
  }

  getUserConversationKey(message: Message) {
    return `${message?.group?.id}`;
  }

  async getMessageById(reference: string) {
    return this.client?.conversations?.getMessageById?.bind(
      this.client?.conversations,
    )(reference);
  }

  async canMessage(address: string): Promise<boolean> {
    const isOnXMTP = await this.client?.canMessage([address]);
    return isOnXMTP ? true : false;
  }

  // Function to retrieve the last shared secret from agent messages
  async getLastAgentMessageSharedSecret(
    address: string,
  ): Promise<string | undefined> {
    try {
      // Get the inbox ID for the given address
      const inboxId = await this.client?.getInboxIdByAddress(address);
      if (!inboxId) {
        console.error(`Invalid receiver address ${address}`);
        return undefined;
      }

      // List all direct message conversations
      const conversations = await this.client?.conversations.listDms();
      if (!conversations) {
        console.error(`No conversations found ${inboxId}`);
        return undefined;
      }

      // Find the conversation with the matching inbox ID
      const conversation = conversations?.find(
        (c: Conversation) => c.dmPeerInboxId === inboxId,
      );

      if (!conversation) {
        console.error(`No conversation found ${conversations.length}`);
        return undefined;
      }

      // Retrieve all messages from the conversation
      const messages = await conversation?.messages();
      if (!messages) {
        console.error(`No messages found ${conversation.id}`);
        return undefined;
      }

      // Find the last agent message with a shared secret
      const lastAgentMessageSharedSecret = messages
        .reverse()
        .find(
          (msg: DecodedMessage) =>
            msg.contentType?.typeId === "agent_message" &&
            msg.content.metadata.sharedSecret,
        );
      if (!lastAgentMessageSharedSecret) {
        console.error(`No shared secret found ${conversation.id}`);
        return undefined;
      }

      // Return the shared secret
      return lastAgentMessageSharedSecret?.content?.metadata
        .sharedSecret as string;
    } catch (error) {
      console.error(`Error getting last agent message shared secret: ${error}`);
      return undefined;
    }
  }

  // Function to encrypt a plaintext message for a given receiver
  async encrypt(
    plaintext: string,
    receiverAddress: string,
  ): Promise<{ nonce: string; ciphertext: string }> {
    try {
      // Retrieve the last shared secret or generate a new one if not found
      let sharedSecret =
        await this.getLastAgentMessageSharedSecret(receiverAddress);
      if (!sharedSecret) {
        console.log(
          "No shared secret found on encrypt, generating new one through a handshake",
        );
        sharedSecret = crypto.randomBytes(32).toString("hex");
        let agentMessage: agentMessage = {
          message: "",
          metadata: {
            sharedSecret,
          },
          receivers: [receiverAddress],
          typeId: "agent_message",
        };

        // Send a handshake message with the new shared secret
        await this.send(agentMessage as agentMessage);
        console.log("Sent handshake message");
      }

      // Convert the shared secret to a buffer
      const bufferFromSharedSecret = Buffer.from(sharedSecret as string, "hex");
      if (!bufferFromSharedSecret) {
        throw new Error("encrypt: No buffer secret found");
      }

      // Generate a nonce and create a cipher for encryption
      const nonce = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(
        "chacha20-poly1305",
        bufferFromSharedSecret,
        nonce,
        { authTagLength: 16 },
      );

      // Encrypt the plaintext
      const ciphertext = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();
      const encryptedPayload = Buffer.concat([ciphertext, authTag]);

      // Return the nonce and ciphertext
      return {
        nonce: nonce.toString("hex"),
        ciphertext: encryptedPayload.toString("hex"),
      };
    } catch (error) {
      console.error("Error encrypting message:", error);
      throw error;
    }
  }

  // Function to decrypt a message using the nonce and ciphertext
  async decrypt(
    nonceHex: string,
    ciphertextHex: string,
    senderAddress: string,
  ): Promise<string> {
    try {
      // Convert nonce and ciphertext from hex to buffer
      const nonce = Buffer.from(nonceHex, "hex");
      const encryptedPayload = Buffer.from(ciphertextHex, "hex");

      // Extract the authentication tag and ciphertext
      const authTag = encryptedPayload.slice(-16);
      const ciphertext = encryptedPayload.slice(0, -16);

      // Retrieve the shared secret for decryption
      const sharedSecret =
        await this.getLastAgentMessageSharedSecret(senderAddress);

      if (!sharedSecret) {
        throw new Error(
          `decrypt: No sharedSecret secret found on decrypt for ${senderAddress}`,
        );
      }

      // Convert the shared secret to a buffer
      const bufferFromSharedSecret = Buffer.from(sharedSecret as string, "hex");

      // Create a decipher for decryption
      const decipher = crypto.createDecipheriv(
        "chacha20-poly1305",
        bufferFromSharedSecret,
        nonce,
        { authTagLength: 16 },
      );
      decipher.setAuthTag(authTag);

      // Decrypt the ciphertext
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      // Return the decrypted message as a string
      return decrypted.toString("utf8");
    } catch (error) {
      console.error("Error decrypting message:", error);
      throw error;
    }
  }
}

async function streamMessages(
  onMessage: (message: Message) => Promise<void>,
  client: Client | undefined,
  xmtp: XMTP,
) {
  while (true) {
    try {
      await client?.conversations.sync();
      await client?.conversations.list();
      const stream = await client?.conversations.streamAllMessages();
      if (stream) {
        if (xmtp.agent?.config?.hideInitLogMessage !== true) {
        }
        for await (const message of stream) {
          let conversation = await xmtp.getConversationFromMessage(message);
          if (message && conversation) {
            try {
              const { senderInboxId, kind } = message as DecodedMessage;

              if (
                // Filter out membership_change messages and sent by one
                senderInboxId?.toLowerCase() ===
                  client?.inboxId.toLowerCase() &&
                kind !== "membership_change"
              ) {
                continue;
              }
              const parsedMessage = await parseMessage(
                message,
                conversation,
                client as Client,
              );
              await onMessage(parsedMessage as Message);
            } catch (e) {
              console.log(`error`, e);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Stream encountered an error:`, err);
    }
  }
}

function createSigner(user: UserReturnType) {
  return {
    getAddress: () => user.account.address,
    signMessage: async (message: string) => {
      const signature = await user.wallet.signMessage({
        account: user.account,
        message,
      });
      return toBytes(signature);
    },
  };
}

export function createUser(key: string): UserReturnType {
  const account = privateKeyToAccount(key as `0x${string}`);
  return {
    key,
    account,
    wallet: createWalletClient({
      account,
      chain: mainnet,
      transport: http(),
    }),
  };
}

export async function parseMessage(
  message: DecodedMessage | undefined | null,
  conversation: Conversation | undefined,
  client: Client,
): Promise<Message | undefined> {
  if (message == null) return undefined;
  let typeId = message.contentType?.typeId ?? "text";
  let content = message.content;
  if (typeId == "text") {
    content = {
      text: content,
    };
  } else if (typeId == "reply") {
    let previousMsg = await client.conversations.getMessageById(
      message.content?.reference as string,
    );
    content = {
      previousMsg: previousMsg,
      reply: content.content,
      text: content.content,
      reference: content.reference,
    };
  } else if (typeId == "reaction") {
    content = {
      reaction: content.content,
      reference: content.reference,
    };
  } else if (message.contentType?.typeId == "remote_attachment") {
    const attachment = await RemoteAttachmentCodec.load(
      message.content,
      client,
    );
    content = {
      attachment: attachment as string,
    };
  } else if (typeId == "read_receipt") {
    //Log read receipt
  } else if (typeId == "agent_message") {
    content = {
      text: message.content.text,
      metadata: message.content.metadata,
    };
  } else if (typeId == "attachment") {
    const blobdecoded = new Blob([message.content.data], {
      type: message.content.mimeType,
    });
    const url = URL.createObjectURL(blobdecoded);

    content = {
      attachment: url,
    };
  }
  let date = message.sentAt;
  let sender: User | undefined = undefined;

  await conversation?.sync();
  const members = await conversation?.members();
  let membersArray = members?.map((member: any) => ({
    inboxId: member.inboxId,
    address: member.accountAddresses[0],
    accountAddresses: member.accountAddresses,
    installationIds: member.installationIds,
  })) as User[];

  sender = membersArray?.find(
    (member: User) =>
      member.inboxId === (message as DecodedMessage).senderInboxId,
  );
  return {
    id: message.id,
    sender,
    group: {
      id: conversation?.id,
      createdAt: conversation?.createdAt,
      name: conversation?.name,
      members: membersArray,
      admins: conversation?.admins,
      superAdmins: conversation?.superAdmins,
    },
    sent: date as Date,
    content,
    typeId,
    client: {
      address: client.accountAddress,
      inboxId: client.inboxId,
    },
  } as Message;
}
