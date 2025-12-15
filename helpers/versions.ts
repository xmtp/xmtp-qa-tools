import fs from "fs";
import path from "path";
import {
  AgentVersionList,
  detectAgentSDKVersion,
  getActiveAgentVersion,
} from "@agents/versions";
import { APP_VERSION, createSigner } from "@helpers/client";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import { ReplyCodec } from "@xmtp/content-type-reply";
import type { LogLevel, XmtpEnv } from "@xmtp/node-sdk";
import {
  Client as Client43,
  Conversation as Conversation43,
  Dm as Dm43,
  Group as Group43,
} from "@xmtp/node-sdk-4.3.0";
import {
  Client as Client44,
  Conversation as Conversation44,
  Dm as Dm44,
  Group as Group44,
} from "@xmtp/node-sdk-4.4.0";
import {
  Client as Client45,
  Conversation as Conversation45,
  Dm as Dm45,
  Group as Group45,
} from "@xmtp/node-sdk-4.5.0";

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
} from "@xmtp/node-sdk-4.5.0";

// Node SDK version list
export const VersionList = [
  // {
  //   Client: Client40Dev,
  //   Conversation: Conversation430Dev,
  //   Dm: Dm430Dev,
  //   Group: Group430Dev,
  //   nodeSDK: "4.3.0",
  //   nodeBindings: "1.7.0",
  //   auto: true,
  // },
  {
    Client: Client45,
    Conversation: Conversation45,
    Dm: Dm45,
    Group: Group45,
    nodeSDK: "4.5.0",
    nodeBindings: "1.6.0",
    auto: true,
  },
  {
    Client: Client44,
    Conversation: Conversation44,
    Dm: Dm44,
    Group: Group44,
    nodeSDK: "4.4.0",
    nodeBindings: "1.5.0",
    auto: true,
  },
  {
    Client: Client43,
    Conversation: Conversation43,
    Dm: Dm43,
    Group: Group43,
    nodeSDK: "4.3.0",
    nodeBindings: "1.4.0",
    auto: true,
  },
];

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
  const loggingLevel = (process.env.LOGGING_LEVEL ||
    "warn") as unknown as LogLevel;
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
      env: env as unknown as XmtpEnv,
      loggingLevel,
      apiUrl,
      appVersion: APP_VERSION,
      disableDeviceSync: true,
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
        disableDeviceSync: true,
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

/**
 * Detect which node-sdk version is being used by checking the client instance or linked bindings
 */
export async function detectNodeSDKVersion(client: any): Promise<{
  nodeSDK: string | null;
  nodeBindings: string | null;
  libxmtpVersion: string | null;
}> {
  try {
    // First, try to find the client in VersionList
    for (const version of VersionList) {
      if (
        client instanceof version.Client ||
        client?.constructor === version.Client
      ) {
        // Get libxmtp version directly from client
        const libxmtpVersion = await (client as any)?.libxmtpVersion;
        return {
          nodeSDK: version.nodeSDK,
          nodeBindings: version.nodeBindings,
          libxmtpVersion: libxmtpVersion || null,
        };
      }
    }

    // If not found, try to detect from the bindings path
    // Check the symlink path to find which bindings are linked
    const xmtpDir = path.join(process.cwd(), "node_modules", "@xmtp");

    // Try to find the bindings by checking the symlink
    for (const version of VersionList) {
      const bindingsDir = path.join(
        xmtpDir,
        `node-bindings-${version.nodeBindings}`,
      );
      if (fs.existsSync(bindingsDir)) {
        // Get libxmtp version directly from client
        const libxmtpVersion = await (client as any)?.libxmtpVersion;
        return {
          nodeSDK: version.nodeSDK,
          nodeBindings: version.nodeBindings,
          libxmtpVersion: libxmtpVersion || null,
        };
      }
    }
  } catch {
    // Ignore errors
  }

  return {
    nodeSDK: null,
    nodeBindings: null,
    libxmtpVersion: null,
  };
}
/**
 * Get SDK version information for logging
 */
export async function getSDKVersionInfo(
  agent: any,
  client: any,
): Promise<{
  agentSDK: string | null;
  nodeSDK: string | null;
  nodeBindings: string | null;
  libxmtpVersion: string | null;
}> {
  // Detect agent-sdk version
  // Use Agent from the first auto-enabled version (respects auto flag)
  const activeVersion = getActiveAgentVersion(0);
  const AgentClass = agent?.constructor || activeVersion.Agent;
  const agentSDK = detectAgentSDKVersion(AgentClass);

  // Find the corresponding node-sdk version from AgentVersionList
  let nodeSDK: string | null = null;
  let nodeBindings: string | null = null;

  if (agentSDK) {
    const agentVersion = AgentVersionList.find((v) => v.agentSDK === agentSDK);
    if (agentVersion) {
      nodeSDK = agentVersion.nodeSDK;

      // Find the corresponding bindings from VersionList
      const nodeVersion = VersionList.find((v) => v.nodeSDK === nodeSDK);
      if (nodeVersion) {
        nodeBindings = nodeVersion.nodeBindings;
      }
    }
  }

  // Try to detect from client if not found
  if (!nodeSDK || !nodeBindings) {
    const nodeInfo = await detectNodeSDKVersion(client);
    if (nodeInfo.nodeSDK) {
      nodeSDK = nodeInfo.nodeSDK;
    }
    if (nodeInfo.nodeBindings) {
      nodeBindings = nodeInfo.nodeBindings;
    }
  }

  // Get libxmtp version directly from client
  const libxmtpVersion = await (client as any)?.libxmtpVersion;

  const versionInfo: {
    agentSDK: string | null;
    nodeSDK: string | null;
    nodeBindings: string | null;
    libxmtpVersion: string | null;
  } = {
    agentSDK,
    nodeSDK,
    nodeBindings,
    libxmtpVersion: libxmtpVersion || null,
  };
  console.log(`\n📦 SDK Versions:`);
  if (versionInfo.agentSDK) {
    console.log(`  • Agent SDK: ${versionInfo.agentSDK}`);
  }
  if (versionInfo.nodeSDK) {
    console.log(`  • Node SDK: ${versionInfo.nodeSDK}`);
  }
  if (versionInfo.nodeBindings) {
    console.log(`  • Node Bindings: ${versionInfo.nodeBindings}`);
    if (versionInfo.libxmtpVersion) {
      console.log(`    └─ libxmtp: ${versionInfo.libxmtpVersion}`);
    }
  }
  return versionInfo;
}
