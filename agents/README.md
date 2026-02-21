# XMTP Agents

This directory contains all Agent SDK related functionality for the XMTP QA Tools project.

## Structure

```
agents/
├── bots/                    # Interactive XMTP agents
│   ├── echo/                # Simple echo agent
│   ├── gm/                  # GM bot (PM2-deployable)
│   └── key-check/           # Key package checker, fork detection, UX demo
│       ├── handlers/        # Command handlers (debug, forks, groups, keypackages, loadtest, ux)
│       ├── inline-actions.ts
│       └── README.md
├── monitoring/              # Agent monitoring and testing
│   ├── agents-dms.test.ts   # DM first reaction
│   ├── agents-tagged.test.ts
│   ├── agents-untagged.test.ts
│   ├── agents-stress.test.ts
│   └── README.md
├── agents.ts                # Agent config (name, address, networks, live)
├── helper.ts                # Shared helpers (AgentConfig, getMessageBody, waitForResponse)
├── versions.ts              # Agent SDK version list and resolution
└── debug-dm.ts              # Debug DM utility
```

Agent SDK version linking is handled by the repo root `cli/versions.ts` (see `yarn versions`, `yarn agent-versions`).

## Quick start

### Link dependencies

```bash
yarn versions
yarn agent-versions
```

### Running agents

```bash
# Run a specific bot
yarn bot echo --env dev
yarn bot key-check
yarn bot gm --env dev

# Run with a specific Agent SDK version
yarn bot key-check --agentSDK 2.2.0
```

### Agent SDK version management

Version list lives in `agents/versions.ts`; symlinks are managed by `cli/versions.ts`.

```bash
# Use a specific version when running a bot
AGENT_SDK_VERSION=2.2.0 yarn bot key-check
yarn bot key-check --agentSDK 2.2.0
```

### Monitoring agents

See [monitoring/README.md](./monitoring/README.md) for workflow badges and test descriptions.

```bash
# Run agent test suites
yarn test agents-dms
yarn test agents-tagged
yarn test agents-untagged
yarn test agents-stress
```

### Debug and PM2

```bash
# Debug DM helper
yarn debug-dm

# PM2 (see agents/bots/README.md)
yarn bot:pm2
yarn bot:pm2:logs
```
