import fs from "fs";
import path from "path";
import { VersionList } from "@helpers/versions";
import {
  Agent as Agent11,
  MessageContext as MessageContext11,
  type Group as AgentGroupType11,
  type AgentMiddleware as AgentMiddleware11,
  type PermissionLevel as AgentPermissionLevel11,
  type DecodedMessage as DecodedMessage11,
} from "@xmtp/agent-sdk-1.1.0";
import {
  getTestUrl as getTestUrl11,
  logDetails as logDetails11,
} from "@xmtp/agent-sdk-1.1.0/debug";
import {
  Agent as Agent12,
  MessageContext as MessageContext12,
  type Group as AgentGroupType12,
  type AgentMiddleware as AgentMiddleware12,
  type PermissionLevel as AgentPermissionLevel12,
  type DecodedMessage as DecodedMessage12,
  type XmtpEnv as XmtpEnv12,
} from "@xmtp/agent-sdk-1.2.0";
import {
  getTestUrl as getTestUrl12,
  logDetails as logDetails12,
} from "@xmtp/agent-sdk-1.2.0/debug";

// Agent SDK version list
export const AgentVersionList = [
  {
    Agent: Agent12,
    MessageContext: MessageContext12,
    agentSDK: "1.2.0",
    nodeSDK: "4.5.0",
    auto: true,
  },
  {
    Agent: Agent11,
    MessageContext: MessageContext11,
    agentSDK: "1.1.0",
    nodeSDK: "4.4.0",
    auto: true,
  },
];

export const getAgentVersions = (filterAuto: boolean = true) => {
  return filterAuto ? AgentVersionList.filter((v) => v.auto) : AgentVersionList;
};

// Agent SDK functions
export const getActiveAgentVersion = (index = 0) => {
  const versions = getAgentVersions();
  let latestVersion = versions[index];

  if (process.env.AGENT_SDK_VERSION) {
    console.log(
      `[versions] AGENT_SDK_VERSION env var set to: ${process.env.AGENT_SDK_VERSION}`,
    );
    latestVersion = versions.find(
      (v) => v.agentSDK === process.env.AGENT_SDK_VERSION,
    ) as (typeof AgentVersionList)[number];
    if (!latestVersion) {
      throw new Error(
        `Agent SDK version ${process.env.AGENT_SDK_VERSION} not found`,
      );
    }
    console.log(
      `[versions] Selected Agent SDK version: ${latestVersion.agentSDK}`,
    );
  } else {
    console.log(
      `[versions] No AGENT_SDK_VERSION env var, using default: ${latestVersion.agentSDK}`,
    );
  }
  return latestVersion;
};

// Get the active version based on environment variable
const activeVersion = getActiveAgentVersion(0);

// Dynamically export Agent and related types from the active version
export const Agent = activeVersion.Agent;
export const MessageContext = activeVersion.MessageContext;

// Export types - use union types since we can't conditionally export at compile time
// Use InstanceType to get the instance type from the class
export type Agent = InstanceType<typeof activeVersion.Agent>;
export type MessageContext = InstanceType<typeof activeVersion.MessageContext>;
// XmtpEnv11 and XmtpEnv12 are the same type, so use one to avoid duplicate union
export type XmtpEnv = XmtpEnv12;
export type DecodedMessage = DecodedMessage11 | DecodedMessage12;
// For AgentMiddleware, use the active version's type directly to avoid union type issues
export type AgentMiddleware = typeof activeVersion.agentSDK extends "1.1.0"
  ? AgentMiddleware11
  : AgentMiddleware12;
export type AgentGroupType = AgentGroupType11 | AgentGroupType12;
export type AgentPermissionLevel =
  | AgentPermissionLevel11
  | AgentPermissionLevel12;

// Export debug utilities from the active version
// Use unknown and type assertions to handle different SDK versions
export const getTestUrl = (client: unknown) => {
  if (activeVersion.agentSDK === "1.1.0") {
    return getTestUrl11(client as Parameters<typeof getTestUrl11>[0]);
  } else {
    return getTestUrl12(client as Parameters<typeof getTestUrl12>[0]);
  }
};

// Wrapper for logDetails to handle API differences between versions
// In 1.1.0, logDetails expects agent.client, in 1.2.0 it expects agent
export const logDetails = (agentOrClient: unknown) => {
  if (activeVersion.agentSDK === "1.1.0") {
    // Version 1.1.0 expects agent.client
    // If agentOrClient has a .client property, use it; otherwise assume it's already a client
    const client =
      (agentOrClient as { client?: unknown })?.client ?? agentOrClient;
    return logDetails11(client as Parameters<typeof logDetails11>[0]);
  } else {
    // Version 1.2.0 expects agent
    return logDetails12(agentOrClient as Parameters<typeof logDetails12>[0]);
  }
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

    // Try to detect from the module path if available
    // Check which agent-sdk package is actually loaded by iterating through AgentVersionList
    for (const version of AgentVersionList) {
      try {
        const packageName = `@xmtp/agent-sdk-${version.agentSDK}`;
        const modulePath = require.resolve(packageName);
        if (modulePath && fs.existsSync(modulePath)) {
          // Check if the Agent class comes from this package
          const agentSDKPath = path.dirname(modulePath);
          if (agentSDKPath.includes(`agent-sdk-${version.agentSDK}`)) {
            return version.agentSDK;
          }
        }
      } catch {
        // Ignore module resolution errors
      }
    }
  } catch {
    // Ignore errors
  }

  // Default: Use first auto-enabled version (respects auto flag)
  const activeVersion = getActiveAgentVersion(0);
  return activeVersion.agentSDK;
}
