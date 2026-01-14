import fs from "fs";
import path from "path";
import { VersionList } from "@helpers/versions";
import {
  Agent as Agent11,
  MessageContext as MessageContext11,
} from "@xmtp/agent-sdk-1.1.0";
import {
  getTestUrl as getTestUrl11,
  logDetails as logDetails11,
} from "@xmtp/agent-sdk-1.1.0/debug";
import {
  Agent as Agent12,
  MessageContext as MessageContext12,
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
    getTestUrl: getTestUrl12,
    logDetails: logDetails12,
  },
  {
    Agent: Agent11,
    MessageContext: MessageContext11,
    agentSDK: "1.1.0",
    nodeSDK: "4.4.0",
    auto: true,
    getTestUrl: getTestUrl11,
    logDetails: logDetails11,
  },
];

// Agent SDK functions
export const getAgentVersions = (filterAuto: boolean = true) => {
  return filterAuto ? AgentVersionList.filter((v) => v.auto) : AgentVersionList;
};

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

// Get active version and export dynamically
const activeVersion = getActiveAgentVersion(0);

// Export Agent and MessageContext from the active version
export const Agent = activeVersion.Agent;
export const MessageContext = activeVersion.MessageContext;

// Export debug functions from the active version
export const getTestUrl = activeVersion.getTestUrl;
export const logDetails = activeVersion.logDetails;

// Export types - using 1.2.0 as base (types should be compatible)
export type { XmtpEnv } from "@xmtp/agent-sdk-1.2.0";
export type { DecodedMessage } from "@xmtp/agent-sdk-1.2.0";
export type { AgentMiddleware } from "@xmtp/agent-sdk-1.2.0";
export type { Group as AgentGroupType } from "@xmtp/agent-sdk-1.2.0";
export type { PermissionLevel as AgentPermissionLevel } from "@xmtp/agent-sdk-1.2.0";

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
