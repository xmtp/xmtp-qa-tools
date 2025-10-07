# SDK Version Management

## Agent SDK Version Management

```bash
# Setup Agent SDK versions
yarn agent-versions

# Test with specific Agent SDK version
yarn bot key-check --agentSDK 1.1.2
```

### Agent SDK Upgrade Procedure

When upgrading Agent SDK versions:

1. Add `@xmtp/agent-sdk-X.X.X` to package.json
2. Add import for new Agent SDK version to `versions/sdk-agent-versions.ts`
3. Run `yarn agent-versions` to link the new versions
4. Test your agents with the new version

### Agent SDK Version Mapping

Versions are mapped in `versions/sdk-agent-versions.ts`:

```typescript
export const AgentVersionList = [
  {
    Agent: Agent115,
    MessageContext: MessageContext115,
    agentSDK: "1.1.5",
    nodeSDK: "4.2.0", // Agent SDK 1.1.5 uses node-sdk ^4.2.2
    nodeBindings: "1.5.2",
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
yarn bot key-check --agentSDK 1.1.2

# Test with latest version (default)
yarn bot key-check
```
