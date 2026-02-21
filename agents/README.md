# XMTP Agents

This directory contains all Agent SDK related functionality for the XMTP QA Tools project.

## Structure

```
agents/
├── bots/                    # Interactive XMTP agents
│   ├── key-check/          # Key management and testing agent
│   ├── echo/               # Simple echo agent
│   ├── gang/               # Group management agent
│   ├── csx/                # CSX integration agent
│   └── utils/              # Shared agent utilities
├── monitoring/              # Agent monitoring and testing
│   ├── agents-*.test.ts    # Various agent test suites
│   ├── agents.ts           # Agent management utilities
│   └── endpoint.ts         # Agent endpoint testing
└── versions/      # Agent SDK version management
    ├── agent-sdk.ts    # Agent SDK version mappings
    ├── cli.ts    # CLI for Agent SDK versions
    └── README.md               # Agent SDK version management docs
```

## Quick Start

### Link dependencies

```bash
yarn versions
yarn agent-versions
```

### Running Agents

```bash
# Run a specific agent
yarn bot key-check

# Run with specific Agent SDK version
yarn bot key-check --agentSDK 1.1.2
```

### Agent SDK Version Management

```bash
# Test with specific version
AGENT_SDK_VERSION=1.0.1 yarn bot key-check --agentSDK 1.0.1
```

### Monitoring Agents

```bash
# Run agent tests
yarn test agents

# Run specific agent test
yarn test agents-stress
```
