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
└── version-management/      # Agent SDK version management
    ├── sdk-agent-versions.ts    # Agent SDK version mappings
    ├── cli-agent-versions.ts    # CLI for Agent SDK versions
    └── README.md               # Agent SDK version management docs
```

## Quick Start

### Running Agents

```bash
# Run a specific agent
yarn bot key-check

# Run with specific Agent SDK version
AGENT_SDK_VERSION=1.1.2 yarn bot key-check
```

### Agent SDK Version Management

```bash
# Setup Agent SDK versions
yarn agent-versions

# Test with specific version
AGENT_SDK_VERSION=1.0.1 yarn bot key-check
```

### Monitoring Agents

```bash
# Run agent tests
yarn test agents

# Run specific agent test
yarn test agents-stress
```

## Agent SDK Versions

| Agent SDK | Node SDK | Node Bindings | Status    |
| --------- | -------- | ------------- | --------- |
| 1.1.5     | 4.2.0    | 1.5.2         | 🟢 auto   |
| 1.1.2     | 4.2.0    | 1.5.2         | 🟢 auto   |
| 1.0.1     | 4.1.0    | 1.4.0         | 🟢 auto   |
| 1.0.0     | 4.1.0    | 1.4.0         | 🟡 manual |

For detailed information, see the individual README files in each subdirectory.

**Note**: Node SDK version management is handled separately in the root `version-management/` directory.
