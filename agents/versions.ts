import fs from "fs";
import path from "path";
import { VersionList } from "@helpers/versions";
import {
  Agent,
  getTestUrl,
  logDetails,
  MessageContext,
  type Group as AgentGroupType,
  type DecodedMessage,
} from "@xmtp/agent-sdk-2.2.0";
import type { PermissionLevel as AgentPermissionLevel } from "@xmtp/node-sdk";

// Agent SDK version list (2.x only)
export const AgentVersionList = [
  {
    Agent,
    MessageContext,
    agentSDK: "2.2.0",
    nodeSDK: "5.0.0",
    auto: true,
  },
];

export const getAgentVersions = (filterAuto: boolean = true) => {
  return filterAuto ? AgentVersionList.filter((v) => v.auto) : AgentVersionList;
};

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

export { Agent, MessageContext, getTestUrl, logDetails };
export type XmtpEnv = "dev" | "production" | "local";
export type { AgentGroupType, DecodedMessage, AgentPermissionLevel };

export const checkAgentVersionFormat = (
  versionList: typeof AgentVersionList,
) => {
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
    for (const version of AgentVersionList) {
      if (version.Agent === AgentClass) {
        return version.agentSDK;
      }
    }

    for (const version of AgentVersionList) {
      try {
        const packageName = `@xmtp/agent-sdk-${version.agentSDK}`;
        const modulePath = require.resolve(packageName);
        if (modulePath && fs.existsSync(modulePath)) {
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

  const activeVersion = getActiveAgentVersion(0);
  return activeVersion.agentSDK;
}
