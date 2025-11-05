import fs from "fs";
import path from "path";
import { APP_VERSION, createSigner } from "@helpers/client";
import {
  Agent as Agent12,
  MessageContext as MessageContext12,
} from "@xmtp/agent-sdk-1.1.2";
import {
  Agent as Agent17, // 1.1.7
  MessageContext as MessageContext17,
} from "@xmtp/agent-sdk-1.1.7";
import {
  Agent as Agent110, // 1.1.10 (latest)
  MessageContext as MessageContext110,
} from "@xmtp/agent-sdk-1.1.10";
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
} from "@xmtp/node-sdk-4.1.0";
import {
  Client as Client420,
  Conversation as Conversation420,
  Dm as Dm420,
  Group as Group420,
} from "@xmtp/node-sdk-4.2.3";
import {
  Client as Client430,
  Conversation as Conversation430,
  Dm as Dm430,
  Group as Group430,
} from "@xmtp/node-sdk-4.3.0";

// Agent SDK exports
export {
  Agent,
  MessageContext,
  type AgentMiddleware,
} from "@xmtp/agent-sdk-1.1.10";

export { getTestUrl, logDetails } from "@xmtp/agent-sdk-1.1.10/debug";

// Node SDK exports
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
  type PermissionLevel,
  type PermissionUpdateType,
  ConsentEntityType,
} from "@xmtp/node-sdk-4.3.0";

// Agent SDK version list
export const AgentVersionList = [
  {
    Agent: Agent110,
    MessageContext: MessageContext110,
    agentSDK: "1.1.10",
    nodeSDK: "4.3.0",
    auto: false,
  },
  {
    Agent: Agent17,
    MessageContext: MessageContext17,
    agentSDK: "1.1.7",
    nodeSDK: "4.2.3",
    auto: true,
  },
  {
    Agent: Agent12,
    MessageContext: MessageContext12,
    agentSDK: "1.1.2",
    nodeSDK: "4.1.0",
    auto: true,
  },
];

// Node SDK version list
export const VersionList = [
  {
    Client: Client430,
    Conversation: Conversation430,
    Dm: Dm430,
    Group: Group430,
    nodeSDK: "4.3.0",
    nodeBindings: "1.6.1",
    auto: true,
  },
  {
    Client: Client420,
    Conversation: Conversation420,
    Dm: Dm420,
    Group: Group420,
    nodeSDK: "4.2.3",
    nodeBindings: "1.5.4",
    auto: true,
  },
  {
    Client: Client410,
    Conversation: Conversation410,
    Dm: Dm410,
    Group: Group410,
    nodeSDK: "4.1.0",
    nodeBindings: "1.4.0",
    auto: true,
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
    auto: true,
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

// Agent SDK functions
export const getActiveAgentVersion = (index = 0) => {
  const versions = getAgentVersions();
  let latestVersion = versions[index];

  if (process.env.AGENT_SDK_VERSION) {
    latestVersion = versions.find(
      (v) => v.agentSDK === process.env.AGENT_SDK_VERSION,
    ) as (typeof AgentVersionList)[number];
    if (!latestVersion) {
      throw new Error(
        `Agent SDK version ${process.env.AGENT_SDK_VERSION} not found`,
      );
    }
  }
  return latestVersion;
};

export const getAgentVersions = (filterAuto: boolean = true) => {
  return filterAuto ? AgentVersionList.filter((v) => v.auto) : AgentVersionList;
};

export const checkAgentVersionFormat = (
  versionList: typeof AgentVersionList,
) => {
  // Agent SDK versions should not include - because it messes up with the worker name-installation conversion
  for (const version of versionList) {
    if (version.agentSDK.includes("-")) {
      throw new Error(`Agent SDK version ${version.agentSDK} contains -`);
    }
  }
};

// Node SDK functions
export const getActiveVersion = (index = 0) => {
  checkNoNameContains(VersionList);
  let latestVersion = getVersions()[index];
  if (process.env.NODE_VERSION) {
    latestVersion = getVersions(false).find(
      (v) => v.nodeBindings === process.env.NODE_VERSION,
    ) as (typeof VersionList)[number];
    if (!latestVersion) {
      throw new Error(`Node SDK version ${process.env.NODE_VERSION} not found`);
    }
  }
  return latestVersion;
};

export const getVersions = (filterAuto: boolean = true) => {
  checkNoNameContains(VersionList);
  return filterAuto ? VersionList.filter((v) => v.auto) : VersionList;
};

export const checkNoNameContains = (versionList: typeof VersionList) => {
  // Node SDK versions should not include - because it messes up with the worker name-installation conversion
  for (const version of versionList) {
    if (version.nodeSDK.includes("-")) {
      throw new Error(`Node SDK version ${version.nodeSDK} contains -`);
    } else if (version.nodeBindings.includes("-")) {
      throw new Error(`Node SDK version ${version.nodeBindings} contains -`);
    }
  }
};

export const regressionClient = async (
  nodeBindings: string,
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
      `Creating API client with: SDK version: ${nodeBindings} walletKey: ${String(walletKey)} API URL: ${String(apiUrl)}`,
    );
  }

  // Ensure the database directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const versionConfig = VersionList.find(
    (v) => v.nodeBindings === nodeBindings,
  );
  if (!versionConfig) {
    throw new Error(`SDK version ${nodeBindings} not found in VersionList`);
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
      appVersion: APP_VERSION,
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
        appVersion: APP_VERSION,
        codecs: [new ReactionCodec(), new ReplyCodec()],
      });
    } else {
      throw error;
    }
  }

  if (!client) {
    throw new Error(`Failed to create client for SDK version ${nodeBindings}`);
  }

  return client;
};

/**
 * Check if a version string is valid
 */
export function isValidSdkVersion(version: string): boolean {
  return VersionList.some((v) => v.nodeBindings === version);
}

export function getDefaultSdkVersion(): string {
  return getActiveVersion().nodeBindings;
}

/**
 * Get SDK versions for testing (respects TEST_VERSIONS env var)
 */
export function getSdkVersionsForTesting(): string[] {
  let sdkVersions = [getDefaultSdkVersion()];

  if (process.env.TEST_VERSIONS) {
    sdkVersions = VersionList.slice(0, parseInt(process.env.TEST_VERSIONS)).map(
      (v) => v.nodeBindings,
    );
  }

  return sdkVersions;
}
