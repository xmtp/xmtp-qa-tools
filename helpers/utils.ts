import fs from "fs";
import path from "path";
import newInboxes from "@helpers/inboxes.json";
import type { Worker, WorkerManager } from "@workers/manager";
import { type Conversation } from "@xmtp/node-sdk";
import {
  Client as Client47,
  Conversation as Conversation47,
  Dm as Dm47,
  Group as Group47,
} from "@xmtp/node-sdk-47";
import {
  Client as Client100,
  Conversation as Conversation100,
  Dm as Dm100,
  Group as Group100,
} from "@xmtp/node-sdk-100";
import {
  Client as Client105,
  Conversation as Conversation105,
  Dm as Dm105,
  Group as Group105,
} from "@xmtp/node-sdk-105";
import {
  Client as Client202,
  Conversation as Conversation202,
  Dm as Dm202,
  Group as Group202,
} from "@xmtp/node-sdk-202";
import {
  Client as Client203,
  Conversation as Conversation203,
  Dm as Dm203,
  Group as Group203,
} from "@xmtp/node-sdk-203";
import {
  Client as Client204,
  Conversation as Conversation204,
  Dm as Dm204,
  Group as Group204,
} from "@xmtp/node-sdk-204";
import {
  Client as Client205,
  Conversation as Conversation205,
  Dm as Dm205,
  Group as Group205,
} from "@xmtp/node-sdk-205";
import {
  Client as Client206,
  Conversation as Conversation206,
  Dm as Dm206,
  Group as Group206,
} from "@xmtp/node-sdk-206";
import {
  Client as Client208,
  Conversation as Conversation208,
  Dm as Dm208,
  Group as Group208,
} from "@xmtp/node-sdk-208";
import {
  Client as Client209,
  Conversation as Conversation209,
  Dm as Dm209,
  Group as Group209,
} from "@xmtp/node-sdk-209";
import {
  Client as Client210,
  Conversation as Conversation210,
  Dm as Dm210,
  Group as Group210,
} from "@xmtp/node-sdk-210";
import {
  Client as ClientMls,
  Conversation as ConversationMls,
} from "@xmtp/node-sdk-mls";
import { getEnvPath } from "./client";
import manualUsers from "./manualusers.json";

export type GroupMetadataContent = {
  metadataFieldChanges: Array<{
    fieldName: string;
    newValue: string;
    oldValue: string;
  }>;
};

// Add type definition for manual users
export type ManualUser = {
  name: string;
  app: string;
  [key: string]: string;
};

// Logging interface
export interface LogInfo {
  timestamp: string;
  level: string;
  message: string;
  [key: symbol]: string | undefined;
}
export const sdkVersionOptions = [
  "202",
  "203",
  "204",
  "205",
  "206",
  "208",
  "209",
  "210",
];

// SDK version mappings
export const sdkVersions = {
  30: {
    Client: ClientMls,
    Conversation: ConversationMls,
    Dm: ConversationMls,
    Group: ConversationMls,
    sdkPackage: "node-sdk-mls",
    bindingsPackage: "node-bindings-mls",
    sdkVersion: "0.0.13",
    libXmtpVersion: "0.0.9",
  },
  47: {
    Client: Client47,
    Conversation: Conversation47,
    Dm: Dm47,
    Group: Group47,
    sdkPackage: "node-sdk-47",
    bindingsPackage: "node-bindings-41",
    sdkVersion: "0.0.47",
    libXmtpVersion: "6bd613d",
  },
  100: {
    Client: Client100,
    Conversation: Conversation100,
    Dm: Dm100,
    Group: Group100,
    sdkPackage: "node-sdk-100",
    bindingsPackage: "node-bindings-100",
    sdkVersion: "1.0.0",
    libXmtpVersion: "c205eec",
  },
  105: {
    Client: Client105,
    Conversation: Conversation105,
    Dm: Dm105,
    Group: Group105,
    sdkPackage: "node-sdk-105",
    bindingsPackage: "node-bindings-113",
    sdkVersion: "1.0.5",
    libXmtpVersion: "6eb1ce4",
  },
  202: {
    Client: Client202,
    Conversation: Conversation202,
    Dm: Dm202,
    Group: Group202,
    sdkPackage: "node-sdk-202",
    bindingsPackage: "node-bindings-120-1",
    sdkVersion: "2.0.2",
    libXmtpVersion: "bed98df",
  },
  203: {
    Client: Client203,
    Conversation: Conversation203,
    Dm: Dm203,
    Group: Group203,
    sdkPackage: "node-sdk-203",
    bindingsPackage: "node-bindings-120-2",
    sdkVersion: "2.0.3",
    libXmtpVersion: "c24af30",
  },
  204: {
    Client: Client204,
    Conversation: Conversation204,
    Dm: Dm204,
    Group: Group204,
    sdkPackage: "node-sdk-204",
    bindingsPackage: "node-bindings-120-3",
    sdkVersion: "2.0.4",
    libXmtpVersion: "068bb4c",
  },
  205: {
    Client: Client205,
    Conversation: Conversation205,
    Dm: Dm205,
    Group: Group205,
    sdkPackage: "node-sdk-205",
    bindingsPackage: "node-bindings-120-4",
    sdkVersion: "2.0.5",
    libXmtpVersion: "b96f93d",
  },
  206: {
    Client: Client206,
    Conversation: Conversation206,
    Dm: Dm206,
    Group: Group206,
    sdkPackage: "node-sdk-206",
    bindingsPackage: "node-bindings-116",
    sdkVersion: "2.0.6",
    libXmtpVersion: "1ab3225",
  },
  208: {
    Client: Client208,
    Conversation: Conversation208,
    Dm: Dm208,
    Group: Group208,
    sdkPackage: "node-sdk-208",
    bindingsPackage: "node-bindings-118",
    sdkVersion: "2.0.8",
    libXmtpVersion: "bfadb76",
  },
  209: {
    Client: Client209,
    Conversation: Conversation209,
    Dm: Dm209,
    Group: Group209,
    sdkPackage: "node-sdk-209",
    bindingsPackage: "node-bindings-120-5",
    sdkVersion: "2.0.9",
    libXmtpVersion: "ef2c57d",
  },
  210: {
    Client: Client210,
    Conversation: Conversation210,
    Dm: Dm210,
    Group: Group210,
    sdkPackage: "node-sdk-210",
    bindingsPackage: "node-bindings-120",
    sdkVersion: "2.1.0",
    libXmtpVersion: "7b9b4d0",
  },
};

/**
 * Creates random installations for a worker
 */
export const createRandomInstallations = async (
  count: number,
  worker: Worker,
): Promise<Worker | undefined> => {
  console.debug(`[${worker.name}] Creating ${count} installations`);
  const initialState = await worker.client.preferences.inboxState(true);
  console.debug(
    `[${worker.name}] Initial inbox state: ${JSON.stringify(initialState)}`,
  );

  for (let i = 0; i < count; i++) {
    console.debug(`[${worker.name}] Creating installation ${i + 1}`);
    await worker.worker?.clearDB();
    await worker.worker?.initialize();
    await sleep(1000);
  }

  const finalState = await worker.client.preferences.inboxState(true);
  console.debug(
    `[${worker.name}] Created ${count} installations. Final state: ${JSON.stringify(finalState)}`,
  );
  return worker;
};

/**
 * Gets a random version from the versions array
 */
export const getRandomVersion = (versions: string[]): string =>
  versions[Math.floor(Math.random() * versions.length)];

/**
 * Randomly reinstalls a worker
 */
export const randomReinstall = async (
  workers: WorkerManager,
): Promise<void> => {
  const worker = workers.getRandomWorkers(1)[0];
  console.debug(`[${worker.name}] Reinstalling worker`);
  await worker.worker?.reinstall();
};

/**
 * Randomly removes database from workers
 */
export const randomlyRemoveDb = async (
  workers: WorkerManager,
): Promise<void> => {
  for (const worker of workers.getAll()) {
    if (Math.random() < 0.5) {
      console.warn(
        `${worker.name} terminates, deletes local data, and restarts`,
      );
      await worker.worker?.clearDB();
      await worker.worker?.initialize();
    }
  }
};

export const getManualUsers = (filterBy: string[] = []): ManualUser[] => {
  return (manualUsers as ManualUser[]).filter(
    (r) => filterBy.includes(r.name) || filterBy.includes(r.app),
  );
};

/**
 * Sleep utility function
 */
export const sleep = (ms: number = 1000): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export function getRandomInboxIds(count: number) {
  return newInboxes
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((inbox) => inbox.inboxId);
}
export function getInboxIds(count: number) {
  return newInboxes.slice(0, count).map((inbox) => inbox.inboxId);
}
export function getAddresses(count: number) {
  return newInboxes.slice(0, count).map((inbox) => inbox.accountAddress);
}

/**
 * Appends a variable to the .env file
 */
export const appendToEnv = (key: string, value: string): void => {
  try {
    const envPath = getEnvPath();
    console.debug(`[appendToEnv] Env path resolved to: ${envPath}`);
    console.debug(`[appendToEnv] File exists: ${fs.existsSync(envPath)}`);

    // Update process.env
    if (key in process.env) {
      process.env[key] = value;
    }

    // Read/create .env file
    let envContent = "";
    try {
      envContent = fs.readFileSync(envPath, "utf8");
      console.debug(
        `[appendToEnv] Read existing .env content (${envContent.length} chars)`,
      );
    } catch (error: unknown) {
      console.debug(
        `[appendToEnv] Creating new .env file, error reading: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Escape regex special chars
    const escapedKey = key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    console.debug(`[appendToEnv] Escaped key: ${escapedKey}`);

    // Update or add the key
    if (envContent.includes(`${key}=`)) {
      console.debug(`[appendToEnv] Key ${key} already exists, updating`);
      envContent = envContent.replace(
        new RegExp(`${escapedKey}=.*(\\r?\\n|$)`, "g"),
        `${key}="${value}"$1`,
      );
    } else {
      console.debug(`[appendToEnv] Key ${key} does not exist, appending`);
      envContent += `\n${key}="${value}"\n`;
    }

    console.debug(`[appendToEnv] About to write to file: ${envPath}`);
    console.debug(
      `[appendToEnv] New content length: ${envContent.length} chars`,
    );

    fs.writeFileSync(envPath, envContent);
    console.debug(`[appendToEnv] Successfully wrote to file`);

    // Verify the write
    const verifyContent = fs.readFileSync(envPath, "utf8");
    const hasOurKey = verifyContent.includes(`${key}=`);
    console.debug(
      `[appendToEnv] Verification - file contains ${key}: ${hasOurKey}`,
    );

    console.debug(`Updated .env with ${key}: ${value}`);
  } catch (error) {
    console.error(`Failed to update .env with ${key}:`, error);
  }
};

export const getFixedNames = (count: number): string[] => {
  return [...defaultNames].slice(0, count);
};
export async function removeDataFolder(): Promise<void> {
  const dataPath = path.join(process.cwd(), ".data");
  if (fs.existsSync(dataPath)) {
    await fs.promises.rm(dataPath, { recursive: true, force: true });
  }
}
export function getMultiVersion(count: number): string[] {
  const descriptors: string[] = [];
  for (const descriptor of getFixedNames(count)) {
    const randomSdkVersion =
      sdkVersionOptions[Math.floor(Math.random() * sdkVersionOptions.length)];
    descriptors.push(`${descriptor}-a-${randomSdkVersion}`);
  }

  return descriptors;
}
export const getRandomNames = (count: number): string[] => {
  return [...defaultNames].sort(() => Math.random() - 0.5).slice(0, count);
};
export const GM_BOT_ADDRESS = "0x194c31cae1418d5256e8c58e0d08aee1046c6ed0";
// Default worker names
export const defaultNames = [
  "bob",
  "alice",
  "fabri",
  "elon",
  "joe",
  "charlie",
  "dave",
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
  "walt",
  "uma",
  "vince",
  "xena",
  "yara",
  "zara",
  "guada", // max 61
];

export const defaultValues = {
  amount: 5, // 5 messages
  playwrightBeforeSendTimeout: 1000, // 1 second
  streamTimeout: 10000, // 3 seconds
  timeout: 40000, // 40 seconds
  perMessageTimeout: 3000, // 3 seconds
  defaultNames,
};
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

export const personalities = [
  {
    name: "sam",
    personality: "Sam personally hates GPT and AI. Its kind of a jerk.",
  },
  {
    name: "walt",
    personality: "Walt is a bit more friendly. He likes to make jokes.",
  },
  {
    name: "tina",
    personality:
      "Tina its non-tech savvy. She doesn't know much about anything.",
  },
];

/**
 * Log a message to the console and send it to a conversation
 * @param message The message to log and send
 * @param conversation The conversation to send the message to
 * @param level The log level (default: 'info')
 * @returns A promise that resolves when the message is sent
 */
export const logAndSend = async (
  message: string,
  conversation: Conversation,
  level: "info" | "warn" | "error" = "info",
): Promise<void> => {
  // Log to console based on level
  switch (level) {
    case "warn":
      console.warn(message);
      break;
    case "error":
      console.error(message);
      break;
    default:
      console.debug(message);
  }

  // Send to conversation if provided
  if (conversation && typeof conversation.send === "function") {
    await conversation.send(message);
  }
};
