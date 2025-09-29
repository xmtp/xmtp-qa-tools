# SDK version management

### Upgrade procedure

When upgrading XMTP node-sdk versions, update these 3 files:

1. Add `@xmtp/node-sdk-X.X.X` and `@xmtp/node-bindings-X.X.X` to package.json.
2. Add import for new SDK version to `workers/versions.ts`.
3. Run `yarn versions` to link the new versions.
4. Run `yarn regression` to check regression of latest 3 versions.

### Version mapping system

Versions are mapped in `workers/versions.ts`:

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
