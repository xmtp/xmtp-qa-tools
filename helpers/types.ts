import { ConsentEntityType, ConsentState } from "@xmtp/node-bindings"; // Update this import
import {
  Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import type { WorkerClient } from "./workers/main";

export type WorkerStreamMessage = {
  type: "stream_message";
  message: DecodedMessage;
};
export { ConsentEntityType, ConsentState };
export type { Conversation, DecodedMessage, XmtpEnv };
export { Client };
// Define the expected return type of verifyStream
export type VerifyStreamResult = {
  allReceived: boolean;
  messages: string[][];
};

export const defaultValues = {
  amount: 5,
  timeout: 40000,
  perMessageTimeout: 2000,
  sdkVersion: "44",
  installationId: "a",
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
export enum WorkerNames {
  FABRI = "fabri",
  BOT = "bot",
  ELON = "elon",
  ALICE = "alice",
  BOB = "bob",
  JOE = "joe",
  CHARLIE = "charlie",
  DAVE = "dave",
  ROSALIE = "rosalie",
  EVE = "eve",
  FRANK = "frank",
  GRACE = "grace",
  HENRY = "henry",
  IVY = "ivy",
  JACK = "jack",
  KAREN = "karen",
  LARRY = "larry",
  MARY = "mary",
  NANCY = "nancy",
  OSCAR = "oscar",
  PAUL = "paul",
  QUINN = "quinn",
  RACHEL = "rachel",
  STEVE = "steve",
  TOM = "tom",
  URSULA = "ursula",
  VICTOR = "victor",
  WENDY = "wendy",
  XAVIER = "xavier",
  YOLANDA = "yolanda",
  ZACK = "zack",
  ADAM = "adam",
  BELLA = "bella",
  CARL = "carl",
  DIANA = "diana",
  ERIC = "eric",
  FIONA = "fiona",
  GEORGE = "george",
  HANNAH = "hannah",
  IAN = "ian",
  JULIA = "julia",
  KEITH = "keith",
  LISA = "lisa",
  MIKE = "mike",
  NINA = "nina",
  OLIVER = "oliver",
  PENNY = "penny",
  QUENTIN = "quentin",
  ROSA = "rosa",
  SAM = "sam",
  TINA = "tina",
  UMA = "uma",
  VINCE = "vince",
  WALT = "walt",
  XENA = "xena",
  YARA = "yara",
  ZARA = "zara",
  GUADA = "guada",
  //max 61
}

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
