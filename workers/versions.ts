import { createSigner } from "@helpers/client";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import { ReplyCodec } from "@xmtp/content-type-reply";
import { type LogLevel, type XmtpEnv } from "@xmtp/node-sdk";
import {
  Client as Client209,
  Conversation as Conversation209,
  Dm as Dm209,
  Group as Group209,
} from "@xmtp/node-sdk-2.0.9";
import {
  Client as Client210,
  Conversation as Conversation210,
  Dm as Dm210,
  Group as Group210,
} from "@xmtp/node-sdk-2.1.0";
import {
  Client as Client220,
  Conversation as Conversation220,
  Dm as Dm220,
  Group as Group220,
} from "@xmtp/node-sdk-2.2.1";
import {
  Client as Client300,
  Conversation as Conversation300,
  Dm as Dm300,
  Group as Group300,
} from "@xmtp/node-sdk-3.0.1";
import {
  Client as Client310,
  Conversation as Conversation310,
  Dm as Dm310,
  Group as Group310,
} from "@xmtp/node-sdk-3.1.1";
import {
  Client as Client312,
  Conversation as Conversation312,
  Dm as Dm312,
  Group as Group312,
} from "@xmtp/node-sdk-3.1.2";
import {
  Client as Client320,
  Conversation as Conversation320,
  Dm as Dm320,
  Group as Group320,
} from "@xmtp/node-sdk-3.2.0";
import {
  Client as Client321,
  Conversation as Conversation321,
  Dm as Dm321,
  Group as Group321,
} from "@xmtp/node-sdk-3.2.1";
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
} from "@xmtp/node-sdk"; // replace with @xmtp/node-sdk 3.2.2 for specific version across all files

// SDK version mappings
export const VersionList = [
  {
    Client: Client401,
    Conversation: Conversation401,
    Dm: Dm401,
    Group: Group401,
    nodeSDK: "4.0.1",
    nodeBindings: "1.3.3",
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
  {
    Client: Client321,
    Conversation: Conversation321,
    Dm: Dm321,
    Group: Group321,
    nodeSDK: "3.2.1",
    nodeBindings: "1.3.1",
    auto: true,
  },
  {
    Client: Client320,
    Conversation: Conversation320,
    Dm: Dm320,
    Group: Group320,
    nodeSDK: "3.2.0",
    nodeBindings: "1.3.0",
    auto: true,
  },
  {
    Client: Client312,
    Conversation: Conversation312,
    Dm: Dm312,
    Group: Group312,
    nodeSDK: "3.1.2",
    nodeBindings: "1.2.8",
    auto: true,
  },
  {
    Client: Client310,
    Conversation: Conversation310,
    Dm: Dm310,
    Group: Group310,
    nodeSDK: "3.1.1",
    nodeBindings: "1.2.7",
    auto: true,
  },
  {
    Client: Client300,
    Conversation: Conversation300,
    Dm: Dm300,
    Group: Group300,
    nodeSDK: "3.0.1",
    nodeBindings: "1.2.5",
    auto: true,
  },
  {
    Client: Client220,
    Conversation: Conversation220,
    Dm: Dm220,
    Group: Group220,
    nodeSDK: "2.2.1",
    nodeBindings: "1.2.2",
    auto: true,
  },
  {
    Client: Client210,
    Conversation: Conversation210,
    Dm: Dm210,
    Group: Group210,
    nodeSDK: "2.1.0",
    nodeBindings: "1.2.0",
    auto: true,
  },
  {
    Client: Client209,
    Conversation: Conversation209,
    Dm: Dm209,
    Group: Group209,
    nodeSDK: "2.0.9",
    nodeBindings: "1.1.8",
    auto: true,
  },
];

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
): Promise<unknown> => {
  const loggingLevel = (process.env.LOGGING_LEVEL || "error") as LogLevel;
  const apiUrl = apiURL;
  if (apiUrl) {
    console.debug(
      `Creating API client with: SDK version: ${nodeSDK} walletKey: ${String(walletKey)} API URL: ${String(apiUrl)}`,
    );
  }

  const versionConfig = VersionList.find((v) => v.nodeSDK === nodeSDK);
  if (!versionConfig) {
    throw new Error(`SDK version ${nodeSDK} not found in VersionList`);
  }
  const ClientClass = versionConfig.Client;
  let client = null;

  const signer = createSigner(walletKey);
  // @ts-expect-error - TODO: fix this
  client = await ClientClass.create(signer, {
    dbEncryptionKey,
    dbPath,
    env,
    loggingLevel,
    apiUrl,
    codecs: [new ReactionCodec(), new ReplyCodec()],
  });

  if (!client) {
    throw new Error(`Failed to create client for SDK version ${nodeSDK}`);
  }

  return client;
};
