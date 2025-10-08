import {
  Agent as Agent100,
  MessageContext as MessageContext100,
} from "@xmtp/agent-sdk-1.0.0";
import {
  Agent as Agent101,
  MessageContext as MessageContext101,
} from "@xmtp/agent-sdk-1.0.1";
import {
  Agent as Agent115,
  MessageContext as MessageContext115,
} from "@xmtp/agent-sdk-1.1.6";

// Export the latest version as default
export {
  Agent,
  MessageContext,
  type AgentMiddleware,
  type Group,
  type IdentifierKind,
  type PermissionLevel,
} from "@xmtp/agent-sdk-1.1.6";

export { getTestUrl } from "@xmtp/agent-sdk-1.1.6/debug";

export const AgentVersionList = [
  {
    Agent: Agent115,
    MessageContext: MessageContext115,
    agentSDK: "1.1.6",
    nodeSDK: "4.2.3",
    nodeBindings: "1.5.4",
    auto: true,
  },
  {
    Agent: Agent101,
    MessageContext: MessageContext101,
    agentSDK: "1.0.1",
    nodeSDK: "4.1.0",
    nodeBindings: "1.4.0",
    auto: true,
  },
  {
    Agent: Agent100,
    MessageContext: MessageContext100,
    agentSDK: "1.0.0",
    nodeSDK: "4.1.0",
    nodeBindings: "1.4.0",
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
