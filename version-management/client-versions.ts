import fs from "fs";
import path from "path";
import { createSigner } from "@helpers/client";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import { ReplyCodec } from "@xmtp/content-type-reply";
import {
  Client as Client322,
  Conversation as Conversation322,
  Dm as Dm322,
  Group as Group322,
} from "@xmtp/node-sdk-3.2.2";
import {
  Client as Client401,
  Conversation as Conversation401,
  Dm as Dm401,
  Group as Group401,
} from "@xmtp/node-sdk-4.0.1";
import {
  Client as Client402,
  Conversation as Conversation402,
  Dm as Dm402,
  Group as Group402,
  type LogLevel,
  type XmtpEnv,
} from "@xmtp/node-sdk-4.0.2";
import {
  Client as Client403,
  Conversation as Conversation403,
  Dm as Dm403,
  Group as Group403,
} from "@xmtp/node-sdk-4.0.3";
import {
  Client as Client410,
  Conversation as Conversation410,
  Dm as Dm410,
  Group as Group410,
} from "@xmtp/node-sdk-4.1.0rc1";

export {
  Client,
  ConsentState,
  type Signer,
  type ClientOptions,
  type Conversation,
  IdentifierKind,
  type DecodedMessage,
  type Dm,
  type Group,
  LogLevel,
  type XmtpEnv,
  type GroupMember,
  type KeyPackageStatus,
  type PermissionUpdateType,
  ConsentEntityType,
} from "@xmtp/node-sdk-4.1.0rc1";
export const VersionList = [
  {
    Client: Client410,
    Conversation: Conversation410,
    Dm: Dm410,
    Group: Group410,
    nodeSDK: "4.1.0rc1",
    nodeBindings: "1.4.0rc1",
    auto: false,
  },
  {
    Client: Client403,
    Conversation: Conversation403,
    Dm: Dm403,
    Group: Group403,
    nodeSDK: "4.0.3",
    nodeBindings: "1.3.6",
    auto: true,
  },
  {
    Client: Client402,
    Conversation: Conversation402,
    Dm: Dm402,
    Group: Group402,
    nodeSDK: "4.0.2",
    nodeBindings: "1.3.5",
    auto: false,
  },
  {
    Client: Client401,
    Conversation: Conversation401,
    Dm: Dm401,
    Group: Group401,
    nodeSDK: "4.0.1",
    nodeBindings: "1.3.4",
    auto: true,
  },
  {
    Client: Client322,
    Conversation: Conversation322,
    Dm: Dm322,
    Group: Group322,
    nodeSDK: "3.2.2",
    nodeBindings: "1.3.3",
    auto: true,
  },
];
export const getActiveVersion = (index = 0) => {
  checkNoNameContains(VersionList);
  let nodesdk = getVersions()[index];
  if (process.env.NODE_VERSION) {
    nodesdk = getVersions(false).find(
      (v) => v.nodeSDK === process.env.NODE_VERSION,
    ) as (typeof VersionList)[number];
    if (!nodesdk) {
      throw new Error(`Node version ${process.env.NODE_VERSION} not found`);
    }
  }
  return nodesdk;
};
export const getVersions = (filterAuto: boolean = true) => {
  checkNoNameContains(VersionList);
  return filterAuto ? VersionList.filter((v) => v.auto) : VersionList;
};

export const checkNoNameContains = (versionList: typeof VersionList) => {
  // Versions should no include - because it messes   up with the worker name-installation conversion. FIX
  for (const version of versionList) {
    if (version.nodeSDK.includes("-")) {
      throw new Error(`Version ${version.nodeSDK} contains -`);
    } else if (version.nodeBindings.includes("-")) {
      throw new Error(`Bindings package ${version.nodeBindings} contains -`);
    }
  }
};

export const regressionClient = async (
  nodeSDK: string,
  walletKey: `0x${string}`,
  dbEncryptionKey: Uint8Array,
  dbPath: string,
  env: XmtpEnv,
  apiURL?: string,
): Promise<any> => {
  const loggingLevel = (process.env.LOGGING_LEVEL || "warn") as LogLevel;
  const apiUrl = apiURL;
  if (apiUrl) {
    console.debug(
      `Creating API client with: SDK version: ${nodeSDK} walletKey: ${String(walletKey)} API URL: ${String(apiUrl)}`,
    );
  }

  // Ensure the database directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const versionConfig = VersionList.find((v) => v.nodeSDK === nodeSDK);
  if (!versionConfig) {
    throw new Error(`SDK version ${nodeSDK} not found in VersionList`);
  }
  const ClientClass = versionConfig.Client;
  let client = null;

  const signer = createSigner(walletKey);

  try {
    // @ts-expect-error - TODO: fix this
    client = await ClientClass.create(signer, {
      dbEncryptionKey,
      dbPath,
      env,
      loggingLevel,
      apiUrl,
      codecs: [new ReactionCodec(), new ReplyCodec()],
    });
  } catch (error) {
    // If database file is corrupted, try using a different path
    if (
      error instanceof Error &&
      error.message.includes("Unable to open the database file")
    ) {
      console.debug(
        `Database file corrupted, trying alternative path: ${dbPath}`,
      );

      // Try with a different database path by adding a timestamp
      const timestamp = Date.now();
      const alternativeDbPath = `${dbPath}-${timestamp}`;

      console.debug(`Using alternative database path: ${alternativeDbPath}`);

      // Try to create the client with the alternative path
      // @ts-expect-error - TODO: fix this
      client = await ClientClass.create(signer, {
        dbEncryptionKey,
        dbPath: alternativeDbPath,
        env,
        loggingLevel,
        apiUrl,
        codecs: [new ReactionCodec(), new ReplyCodec()],
      });
    } else {
      throw error;
    }
  }

  if (!client) {
    throw new Error(`Failed to create client for SDK version ${nodeSDK}`);
  }

  return client;
};
