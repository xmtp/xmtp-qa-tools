import {
  ConsentEntityType,
  ConsentState,
  type Consent,
} from "@xmtp/node-bindings";
import {
  Client,
  type Conversation,
  type DecodedMessage,
  type Installation,
  type Signer,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import type { WorkerClient } from "./workers/main";

export type WorkerStreamMessage = {
  type: "stream_message";
  message: DecodedMessage;
};
export type { Consent };
export { ConsentEntityType, ConsentState };
export type { Conversation, DecodedMessage, Installation, Signer, XmtpEnv };
export { Client };
// Define the expected return type of verifyStream
export type VerifyStreamResult = {
  allReceived: boolean;
  messages: string[][];
};

export interface Persona {
  name: string;
  installationId: string;
  version: string;
  dbPath: string;
  worker: WorkerClient | null;
  client: Client | null;
}

export type GroupMetadataContent = {
  metadataFieldChanges: Array<{
    fieldName: string;
    newValue: string;
    oldValue: string;
  }>;
};

// Default personas as an enum
const defaultNames = [
  "fabri",
  "bot",
  "elon",
  "alice",
  "bob",
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
  sdkVersion: "44",
  installationId: "a",
  defaultNames,
};

// Custom transport that buffers logs in memory
export interface LogInfo {
  timestamp: string;
  level: string;
  message: string;
  [key: symbol]: string | undefined;
}
export interface PersonaBase {
  name: string;
  installationId: string;
  sdkVersion: string;
  walletKey: string;
  encryptionKey: string;
  testName: string;
}

export interface Persona extends PersonaBase {
  worker: WorkerClient | null;
  dbPath: string;
  client: Client | null;
  address: string;
}
