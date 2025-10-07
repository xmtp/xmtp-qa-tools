# SDK version management

## Agent SDK Version Management

### Quick Start for Agent SDK

```bash
# Setup Agent SDK versions
yarn agent-versions

# Test with specific Agent SDK version
AGENT_SDK_VERSION=1.1.2 yarn bot key-check
```

### Agent SDK Upgrade Procedure

When upgrading Agent SDK versions:

1. Add `@xmtp/agent-sdk-X.X.X` to package.json
2. Add import for new Agent SDK version to `version-management/agent-versions.ts`
3. Run `yarn agent-versions` to link the new versions
4. Test your agents with the new version

### Agent SDK Version Mapping

Versions are mapped in `version-management/agent-versions.ts`:

```typescript
export const AgentVersionList = [
  {
    Agent: Agent115,
    MessageContext: MessageContext115,
    agentSDK: "1.1.5",
    auto: true, // Include in automated testing
  },
  // ... more versions
];
```

### Agent SDK Package Aliases

Multiple Agent SDK versions installed via npm aliases:

```json
{
  "dependencies": {
    "@xmtp/agent-sdk-1.0.0": "npm:@xmtp/agent-sdk@1.0.0",
    "@xmtp/agent-sdk-1.1.2": "npm:@xmtp/agent-sdk@1.1.2",
    "@xmtp/agent-sdk-1.1.5": "npm:@xmtp/agent-sdk@1.1.5"
  }
}
```

### Agent SDK Dynamic Linking

`yarn agent-versions` creates symlinks:

```bash
node_modules/@xmtp/
├── agent-sdk -> agent-sdk-1.1.5/  # Points to latest version
├── agent-sdk-1.0.0/
├── agent-sdk-1.1.2/
└── agent-sdk-1.1.5/
```

### Testing Agent SDK Versions

```bash
# Test with specific version
AGENT_SDK_VERSION=1.1.2 yarn bot key-check

# Test with latest version (default)
yarn bot key-check
```

---

## Node SDK Version Management

### Upgrade procedure

When upgrading XMTP bindings and/or node-sdk versions:

1. Add `@xmtp/node-sdk-X.X.X` and `@xmtp/node-bindings-X.X.X` to package.json.
2. Add import for new SDK version to `version-management/client-versions.ts`.
3. Run `yarn versions` to link the new versions.
4. Run `yarn regression` to check regression of latest 3 versions.
5. Create and Merge PR. (so it's tested in CI)

### Version mapping system

Versions are mapped in `version-management/client-versions.ts`:

```typescript
export const VersionList = [
  {
    Client: Client322,
    Conversation: Conversation322,
    Dm: Dm322,
    Group: Group322,
    nodeSDK: "3.2.2", // SDK version
    nodeBindings: "1.3.3", // Bindings version
    auto: true, // Include in automated testing
  },
];
```

### Package aliases

Multiple versions installed via npm aliases:

```json
{
  "dependencies": {
    "@xmtp/node-sdk-3.2.2": "npm:@xmtp/node-sdk@3.2.2",
    "@xmtp/node-bindings-1.3.3": "npm:@xmtp/node-bindings@1.3.3"
  }
}
```

### Dynamic linking

`yarn versions` creates symlinks:

```bash
node_modules/@xmtp/
├── node-sdk-3.2.2/
│   └── node_modules/@xmtp/
│       └── node-bindings -> ../../node-bindings-1.3.3/
└── node-bindings-1.3.3/
```

### Finding libxmtp version

The libxmtp commit hash is in:

```bash
node_modules/@xmtp/node-bindings-X.X.X/dist/version.json
```

### Using versions command to see current mappings

```bash
yarn versions
# shows current SDK → bindings mappings.
```

### Testing specific versions (automated)

```bash
yarn test performance --versions 3  # Test latest 3 auto-enabled versions
yarn test performance --nodeSDK 3.2.2 # custom version
yarn regression  # Vibe check on latest version
```
