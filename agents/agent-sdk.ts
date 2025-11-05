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

// Export the latest version as default
export {
  Agent,
  MessageContext,
  type AgentMiddleware,
  type Group,
  type IdentifierKind,
  type PermissionLevel,
} from "@xmtp/agent-sdk-1.1.10";

export { getTestUrl } from "@xmtp/agent-sdk-1.1.10/debug";

export const AgentVersionList = [
  {
    Agent: Agent110,
    MessageContext: MessageContext110,
    agentSDK: "1.1.10",
    nodeSDK: "4.3.0",
    auto: true,
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
