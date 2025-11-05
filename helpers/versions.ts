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
} from "@xmtp/agent-sdk-1.1.5";
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

// Agent SDK exports - use first auto-enabled version
// Since 1.1.10 has auto: false, we export from 1.1.7 (first auto: true)
export {
  Agent,
  MessageContext,
  type AgentMiddleware,
  type Group as AgentGroupType,
  type PermissionLevel as AgentPermissionLevel,
} from "@xmtp/agent-sdk-1.1.5";

export { getTestUrl, logDetails } from "@xmtp/agent-sdk-1.1.5/debug";

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
    agentSDK: "1.1.5",
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

/**
 * Detect which agent-sdk version is being used by checking the Agent constructor
 */
export function detectAgentSDKVersion(AgentClass: any): string | null {
  try {
    // Check if Agent is from a specific version by comparing constructors
    for (const version of AgentVersionList) {
      if (version.Agent === AgentClass) {
        return version.agentSDK;
      }
    }

    // Since Agent is hardcoded to 1.1.10 in exports, check if it matches
    if (AgentClass === Agent110) {
      return "1.1.10";
    }
    if (AgentClass === Agent17) {
      return "1.1.7";
    }
    if (AgentClass === Agent12) {
      return "1.1.2";
    }

    // Try to detect from the module path if available
    // Check which agent-sdk package is actually loaded
    try {
      const modulePath = require.resolve("@xmtp/agent-sdk-1.1.10");
      if (modulePath && fs.existsSync(modulePath)) {
        // Check if the Agent class comes from this package
        const agentSDKPath = path.dirname(modulePath);
        if (agentSDKPath.includes("agent-sdk-1.1.10")) {
          return "1.1.10";
        }
      }
    } catch {
      // Ignore module resolution errors
    }

    try {
      const modulePath = require.resolve("@xmtp/agent-sdk-1.1.7");
      if (modulePath && fs.existsSync(modulePath)) {
        const agentSDKPath = path.dirname(modulePath);
        if (agentSDKPath.includes("agent-sdk-1.1.7")) {
          return "1.1.7";
        }
      }
    } catch {
      // Ignore module resolution errors
    }

    try {
      const modulePath = require.resolve("@xmtp/agent-sdk-1.1.2");
      if (modulePath && fs.existsSync(modulePath)) {
        const agentSDKPath = path.dirname(modulePath);
        if (agentSDKPath.includes("agent-sdk-1.1.2")) {
          return "1.1.2";
        }
      }
    } catch {
      // Ignore module resolution errors
    }
  } catch {
    // Ignore errors
  }

  // Default: Use first auto-enabled version (respects auto flag)
  const activeVersion = getActiveAgentVersion(0);
  return activeVersion.agentSDK;
}

/**
 * Detect which node-sdk version is being used by checking the client instance or linked bindings
 */
export function detectNodeSDKVersion(client: any): {
  nodeSDK: string | null;
  nodeBindings: string | null;
  bindingsVersion: { branch: string; version: string; date: string } | null;
} {
  try {
    // First, try to find the client in VersionList
    for (const version of VersionList) {
      if (
        client instanceof version.Client ||
        client?.constructor === version.Client
      ) {
        // Try to get the bindings version from the linked node-bindings
        const bindingsVersion = getBindingsVersion(version.nodeBindings);
        return {
          nodeSDK: version.nodeSDK,
          nodeBindings: version.nodeBindings,
          bindingsVersion,
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
        const versionJsonPath = path.join(bindingsDir, "dist", "version.json");
        if (fs.existsSync(versionJsonPath)) {
          try {
            const versionInfo = JSON.parse(
              fs.readFileSync(versionJsonPath, "utf8"),
            );
            // Check if this bindings version matches what the client might be using
            // by checking the client's internal structure or by checking which node-sdk
            // is linked to this bindings
            const nodeSDKDir = path.join(
              xmtpDir,
              `node-sdk-${version.nodeSDK}`,
            );
            const sdkNodeModulesXmtpDir = path.join(
              nodeSDKDir,
              "node_modules",
              "@xmtp",
            );
            const symlinkTarget = path.join(
              sdkNodeModulesXmtpDir,
              "node-bindings",
            );

            if (fs.existsSync(symlinkTarget)) {
              try {
                const stats = fs.lstatSync(symlinkTarget);
                if (stats.isSymbolicLink()) {
                  const target = fs.readlinkSync(symlinkTarget);
                  if (
                    path.resolve(sdkNodeModulesXmtpDir, target) === bindingsDir
                  ) {
                    return {
                      nodeSDK: version.nodeSDK,
                      nodeBindings: version.nodeBindings,
                      bindingsVersion: versionInfo,
                    };
                  }
                }
              } catch {
                // Ignore symlink read errors
              }
            }
          } catch {
            // Ignore version.json read errors
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return {
    nodeSDK: null,
    nodeBindings: null,
    bindingsVersion: null,
  };
}

/**
 * Get the bindings version information from version.json
 */
export function getBindingsVersion(bindingsVersion: string): {
  branch: string;
  version: string;
  date: string;
} | null {
  try {
    const xmtpDir = path.join(process.cwd(), "node_modules", "@xmtp");
    const bindingsDir = path.join(xmtpDir, `node-bindings-${bindingsVersion}`);
    const versionJsonPath = path.join(bindingsDir, "dist", "version.json");

    if (fs.existsSync(versionJsonPath)) {
      const versionInfo = JSON.parse(fs.readFileSync(versionJsonPath, "utf8"));
      return versionInfo;
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Get SDK version information for logging
 */
export function getSDKVersionInfo(
  agent: any,
  client: any,
): {
  agentSDK: string | null;
  nodeSDK: string | null;
  nodeBindings: string | null;
  bindingsVersion: { branch: string; version: string; date: string } | null;
} {
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
    const nodeInfo = detectNodeSDKVersion(client);
    if (nodeInfo.nodeSDK) {
      nodeSDK = nodeInfo.nodeSDK;
    }
    if (nodeInfo.nodeBindings) {
      nodeBindings = nodeInfo.nodeBindings;
    }
  }

  // Get bindings version info
  const bindingsVersion = nodeBindings
    ? getBindingsVersion(nodeBindings)
    : null;

  const versionInfo: {
    agentSDK: string | null;
    nodeSDK: string | null;
    nodeBindings: string | null;
    bindingsVersion: { branch: string; version: string; date: string } | null;
  } = {
    agentSDK,
    nodeSDK,
    nodeBindings,
    bindingsVersion,
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
    if (versionInfo.bindingsVersion) {
      console.log(
        `    └─ libxmtp: ${versionInfo.bindingsVersion.branch}@${versionInfo.bindingsVersion.version} (${versionInfo.bindingsVersion.date})`,
      );
    }
  }
  console.log();

  return versionInfo;
}
