import type { Worker, WorkerManager } from "@workers/manager";
import {
  Client,
  ConsentEntityType,
  ConsentState,
  Conversation,
  Dm,
  Group,
  IdentifierKind,
  type Consent,
  type DecodedMessage,
  type GroupMember,
  type Installation,
  type LogLevel,
  type Signer,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import {
  Client as Client100,
  Conversation as Conversation100,
  Dm as Dm100,
  Group as Group100,
} from "@xmtp/node-sdk-100";

export const sdkVersions = {
  v104: {
    Client,
    Conversation,
    Dm,
    Group,
  },
  v100: {
    Client: Client100,
    Conversation: Conversation100,
    Dm: Dm100,
    Group: Group100,
  },
  // You can add more versions as needed
};

// Export types for use with any version
export type SdkTypes = {
  Consent: Consent;
  DecodedMessage: DecodedMessage;
  GroupMember: GroupMember;
  Installation: Installation;
  LogLevel: LogLevel;
  Signer: Signer;
  XmtpEnv: XmtpEnv;
};

export type { WorkerManager, Worker };
export type WorkerStreamMessage = {
  type: "stream_message";
  message: DecodedMessage;
};
export type { Consent };
export {
  Client,
  ConsentEntityType,
  ConsentState,
  DecodedMessage,
  Conversation,
  Dm,
  Group,
  IdentifierKind,
  type GroupMember,
  type Installation,
  type Signer,
  type LogLevel,
  type XmtpEnv,
};
// Define the expected return type of verifyStream
export type VerifyStreamResult = {
  allReceived: boolean;
  messages: string[][];
};

export type GroupMetadataContent = {
  metadataFieldChanges: Array<{
    fieldName: string;
    newValue: string;
    oldValue: string;
  }>;
};

// Default workers as an enum
const defaultNames = [
  "bob",
  "alice",
  "fabri",
  "elon",
  "joe",
  "charlie",
  "dave",
  "rosalie",
  "eve",
  "frank",
  "grace",
  "henry",
  "ivy",
  "jack",
  "karen",
  "larry",
  "mary",
  "nancy",
  "oscar",
  "paul",
  "quinn",
  "rachel",
  "steve",
  "tom",
  "ursula",
  "victor",
  "wendy",
  "xavier",
  "yolanda",
  "zack",
  "adam",
  "bella",
  "carl",
  "diana",
  "eric",
  "fiona",
  "george",
  "hannah",
  "ian",
  "julia",
  "keith",
  "lisa",
  "mike",
  "nina",
  "oliver",
  "penny",
  "quentin",
  "rosa",
  "sam",
  "tina",
  "uma",
  "vince",
  "walt",
  "xena",
  "yara",
  "zara",
  "guada",
  //max 61
];
export type typeofStream = "message" | "conversation" | "consent" | "none";
export const defaultValues = {
  amount: 5,
  timeout: 40000,
  perMessageTimeout: 3000,
  defaultNames,
};

// Custom transport that buffers logs in memory
export interface LogInfo {
  timestamp: string;
  level: string;
  message: string;
  [key: symbol]: string | undefined;
}
