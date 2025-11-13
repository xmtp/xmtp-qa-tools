// Version configuration without SDK imports
// This file can be imported safely before symlinks are set up

export interface AgentVersionConfig {
  agentSDK: string;
  nodeSDK: string;
  auto: boolean;
}

export interface NodeVersionConfig {
  nodeSDK: string;
  nodeBindings: string;
  auto: boolean;
}

// Agent SDK version list (metadata only, no imports)
export const AgentVersionConfigList: AgentVersionConfig[] = [
  {
    agentSDK: "1.1.10",
    nodeSDK: "4.3.1",
    auto: true,
  },
  {
    agentSDK: "1.1.5",
    nodeSDK: "4.2.3",
    auto: true,
  },
  {
    agentSDK: "1.1.2",
    nodeSDK: "4.1.0",
    auto: true,
  },
];

// Node SDK version list (metadata only, no imports)
export const NodeVersionConfigList: NodeVersionConfig[] = [
  {
    nodeSDK: "4.3.1",
    nodeBindings: "1.6.1",
    auto: true,
  },
  {
    nodeSDK: "4.2.3",
    nodeBindings: "1.5.4",
    auto: true,
  },
  {
    nodeSDK: "4.1.0",
    nodeBindings: "1.4.0",
    auto: true,
  },
  {
    nodeSDK: "4.0.3",
    nodeBindings: "1.3.6",
    auto: true,
  },
  {
    nodeSDK: "4.0.2",
    nodeBindings: "1.3.5",
    auto: true,
  },
  {
    nodeSDK: "4.0.1",
    nodeBindings: "1.3.4",
    auto: true,
  },
  {
    nodeSDK: "3.2.2",
    nodeBindings: "1.3.3",
    auto: true,
  },
];

