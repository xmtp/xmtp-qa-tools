import type { Client, ClientOptions } from "@xmtp/node-sdk";
import type { createWalletClient } from "viem";
import type { privateKeyToAccount } from "viem/accounts";

export type { Client };
export type { ClientOptions };

export type Metadata = {
  isAgent?: boolean;
  [key: string]: any;
};

export type agentMessage = {
  message: string;
  originalMessage?: Message;
  metadata: Metadata;
  receivers?: string[];
  typeId?:
    | "text"
    | "image"
    | "reaction"
    | "reply"
    | "attachment"
    | "read_receipt"
    | "agent_message";
};

export interface UserReturnType {
  key: string;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
}

export type xmtpConfig = {
  path?: string;
  hideInitLogMessage?: boolean;
} & ClientOptions;

export type Agent = {
  name?: string;
  encryptionKey?: string;
  fixedKey?: string;
  onMessage?: (message: Message) => Promise<void>;
  config?: xmtpConfig;
};

export type Conversation = {
  id: string;
  createdAt: Date;
  topic?: string;
  members?: User[];
  admins?: string[];
  name?: string;
  superAdmins?: string[];
};

export type Message = {
  id: string; // Unique identifier for the message
  sent: Date; // Date when the message was sent
  content: {
    text?: string; // Text content of the message
    reply?: string; // Reply content if the message is a reply
    previousMsg?: string; // Reference to the previous message
    attachment?: string; // Attachment content if the message is an attachment
    react?: string; // Reaction content if the message is a reaction
    content: any; // Any other content
    metadata?: any; // Metadata for the message
    remoteAttachment?: any; // Remote attachment content if the message is a remote attachment
    readReceipt?: any; // Read receipt content if the message is a read receipt
    agentMessage?: any; // Agent message content if the message is an agent message
    reaction?: any; // Reaction content if the message is a reaction
    params?: any; // Parameters for the message
    reference?: string; // Reference ID for the message
    skill?: string; // Skill associated with the message
    any?: any; // Any other content
  };
  group?: Conversation; // Group the message belongs to
  sender: User; // Sender of the message
  typeId: string; // Type identifier for the message
  client: {
    address: string;
    inboxId: string;
  };
};

export interface User {
  address: string;
  inboxId: string;
  installationIds: string[];
  accountAddresses: string[];
  username?: string;
  ensDomain?: string;
}
