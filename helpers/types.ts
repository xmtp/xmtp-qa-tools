import type { Worker, WorkerManager } from "@workers/manager";
import {
  ConsentEntityType,
  ConsentState,
  IdentifierKind,
  type Consent,
  type GroupMember,
  type Identifier,
  type Installation,
  type LogLevel,
} from "@xmtp/node-bindings";
import {
  Client,
  Conversation,
  Dm,
  Group,
  type DecodedMessage,
  type XmtpEnv,
  type Signer as XmtpSigner,
} from "@xmtp/node-sdk";

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
  type Identifier,
  type GroupMember,
  type Installation,
  type XmtpEnv,
  type LogLevel,
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

// Signer interface that works with multiple SDK versions
export interface Signer {
  type: "EOA";
  walletType: "EOA"; // For newer SDK versions
  getIdentifier: () => { identifierKind: IdentifierKind; identifier: string };
  getAddress: () => Promise<`0x${string}`>; // For newer SDK versions
  getChainId: () => Promise<bigint>; // For newer SDK versions
  signMessage: (message: string) => Promise<Uint8Array>;
}
