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
  Client as Client45,
  Conversation as Conversation45,
  Dm as Dm45,
  Group as Group45,
} from "@xmtp/node-sdk-4.5.0";
import {
  Client as Client46,
  Conversation as Conversation46,
  Dm as Dm46,
  Group as Group46,
} from "@xmtp/node-sdk-4.6.0";
import {
  Client as Client50,
  Conversation as Conversation50,
  Dm as Dm50,
  Group as Group50,
} from "@xmtp/node-sdk-5.0.0";

// 4.4.0 loaded dynamically to catch version.json import error
let Client44: any;
let Conversation44: any;
let Dm44: any;
let Group44: any;

try {
  const sdk44 = await import("@xmtp/node-sdk-4.4.0");
  Client44 = sdk44.Client;
  Conversation44 = sdk44.Conversation;
  Dm44 = sdk44.Dm;
  Group44 = sdk44.Group;
} catch {
  // version.json not exported, 4.4.0 unavailable
}

// Node SDK exports (using latest version 5.0.0)
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
} from "@xmtp/node-sdk-5.0.0";

/**
 * Version references use simplified versions without patches/pre-release suffixes.
 * The actual package version (e.g., "1.7.0-rc2") is stored in package.json, but we refer to it as "1.7.0" here.
 * This prevents parsing issues with worker name-installation conversion.
 */
export const VersionList = [
  {
    Client: Client50,
    Conversation: Conversation50,
    Dm: Dm50,
    Group: Group50,
    nodeSDK: "5.0.0",
    nodeBindings: "1.7.0",
    auto: true,
  },
  {
    Client: Client46,
    Conversation: Conversation46,
    Dm: Dm46,
    Group: Group46,
    nodeSDK: "4.6.0",
    nodeBindings: "1.6.0",
    auto: true,
  },
  {
    Client: Client45,
    Conversation: Conversation45,
    Dm: Dm45,
    Group: Group45,
    nodeSDK: "4.5.0",
    nodeBindings: "1.6.0",
    auto: true,
  },
  ...(Client44
    ? [
        {
          Client: Client44,
          Conversation: Conversation44,
          Dm: Dm44,
          Group: Group44,
          nodeSDK: "4.4.0",
          nodeBindings: "1.5.0",
          auto: true,
        },
      ]
    : []),
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

/**
 * Check if D14N mode is enabled via environment variable
 * Set XMTP_D14N=true to enable D14N mode
 */
export const isD14NEnabled = (): boolean => {
  const d14nEnv = process.env.XMTP_D14N;
  return d14nEnv === "true" || d14nEnv === "1";
};

/**
 * Compare two semantic version strings.
 * Returns true if version >= minVersion.
 * E.g., compareVersions("1.7.0", "1.6.0") returns true
 */
export const compareVersions = (
  version: string,
  minVersion: string,
): boolean => {
  const vParts = version
    .split("-")[0]
    .split(".")
    .map((p) => parseInt(p, 10) || 0);
  const minParts = minVersion
    .split("-")[0]
    .split(".")
    .map((p) => parseInt(p, 10) || 0);

  for (let i = 0; i < Math.max(vParts.length, minParts.length); i++) {
    const v = vParts[i] || 0;
    const min = minParts[i] || 0;
    if (v > min) return true;
    if (v < min) return false;
  }
  return true; // Equal versions
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

  // Check if D14N mode is explicitly enabled
  const d14nEnabled = isD14NEnabled();
  const apiUrl = apiURL || process.env.XMTP_API_URL;

  // Check if SDK version supports D14N (nodeBindings >= 1.6.0 corresponds to SDK 4.6+)
  const D14N_MIN_VERSION = "1.6.0";
  const supportsD14N = compareVersions(nodeBindings, D14N_MIN_VERSION);

  const clientOptions: any = {
    dbEncryptionKey,
    dbPath,
    env: env as unknown as XmtpEnv,
    loggingLevel,
    appVersion: APP_VERSION,
    disableDeviceSync: true,
    codecs: [new ReactionCodec(), new ReplyCodec()],
  };

  // D14N mode: Use gatewayHost (payer) + apiUrl (grpc) parameters
  // gatewayHost = payer URL for writes (identity registration, sending)
  // apiUrl = grpc URL for reads (queries, sync)
  // V3 mode: Use apiUrl parameter only (or default endpoints)
  if (d14nEnabled) {
    if (!apiUrl) {
      throw new Error(
        "XMTP_D14N=true requires XMTP_API_URL to be set with the D14N grpc URL (e.g., https://grpc.testnet-dev.xmtp.network:443)",
      );
    }
    if (supportsD14N) {
      // Derive payer URL from grpc URL (grpc.* -> payer.*)
      const payerUrl =
        process.env.XMTP_GATEWAY_URL || apiUrl.replace(/grpc\./, "payer.");
      clientOptions.gatewayHost = payerUrl; // Payer URL for writes
      clientOptions.apiUrl = apiUrl; // gRPC URL for reads
      console.log(`[D14N] Using D14N gateway (gatewayHost): ${payerUrl}`);
      console.log(`[D14N] Using D14N node (apiUrl): ${apiUrl}`);
    } else {
      console.warn(
        `[D14N] D14N is enabled but SDK version ${nodeBindings} (< ${D14N_MIN_VERSION}) does not support D14N. Falling back to apiUrl.`,
      );
      clientOptions.apiUrl = apiUrl;
    }
  } else if (apiUrl) {
    clientOptions.apiUrl = apiUrl;
    console.log(`[V3] Using custom API URL: ${apiUrl}`);
  } else {
    console.log(`[V3] Using default network endpoint for env: ${env}`);
  }

  try {
    client = await ClientClass.create(signer as any, clientOptions);
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
      const retryOptions: any = {
        dbEncryptionKey,
        dbPath: alternativeDbPath,
        env,
        loggingLevel,
        appVersion: APP_VERSION,
        disableDeviceSync: true,
        codecs: [new ReactionCodec(), new ReplyCodec()],
      };

      if (d14nEnabled && apiUrl) {
        if (supportsD14N) {
          const payerUrl =
            process.env.XMTP_GATEWAY_URL || apiUrl.replace(/grpc\./, "payer.");
          retryOptions.gatewayHost = payerUrl;
          retryOptions.apiUrl = apiUrl;
        } else {
          console.warn(
            `[D14N] D14N is enabled but SDK version ${nodeBindings} (< ${D14N_MIN_VERSION}) does not support D14N. Falling back to apiUrl.`,
          );
          retryOptions.apiUrl = apiUrl;
        }
      } else if (apiUrl) {
        retryOptions.apiUrl = apiUrl;
      }

      client = await ClientClass.create(signer as any, retryOptions);
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
