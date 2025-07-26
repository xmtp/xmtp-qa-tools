# SDK version management

### Overview

How XMTP SDK versions relate to the underlying `libxmtp` Rust library and how to test with custom versions.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#0D1117', 'primaryTextColor': '#c9d1d9', 'primaryBorderColor': '#30363d', 'lineColor': '#8b949e', 'secondaryColor': '#161b22', 'tertiaryColor': '#161b22' }}}%%

flowchart TD
  nodeSDK["SDK<br/>@xmtp/node-sdk 3.2.2"]
  nodeBindings["Bindings<br/>@xmtp/node-bindings 1.3.3"]
  libxmtp["libxmtp Rust Library<br/>(specific commit/version)"]

  nodeSDK --> |depends on| nodeBindings
  nodeBindings --> |compiled from| libxmtp

  classDef default fill:#161b22,stroke:#30363d,stroke-width:2px,color:#c9d1d9;
```

- **[NodeSDK](https://www.npmjs.com/package/@xmtp/node-sdk?activeTab=versions)**: Thin tsx wrappers providing developer-friendly API
- **[Bindings](https://www.npmjs.com/package/@xmtp/node-bindings?activeTab=versions)**: Compiled Rust code and native bindings
- **[libxmtp](https://github.com/xmtp/libxmtp)**: Core cryptographic and networking logic

### Version mapping system

Versions are mapped in `workers/versions.ts`:

```tsx
export const VersionList = [
  {
    Client: Client322,
    Conversation: Conversation322,
    Dm: Dm322,
    Group: Group322,
    nodeSDK: "3.2.2",
    nodeBindings: "1.3.3",
    auto: true,
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

```
node_modules/@xmtp/
├── node-sdk-3.2.2/
│   └── node_modules/@xmtp/
│       └── node-bindings -> ../../node-bindings-1.3.3/
└── node-bindings-1.3.3/
```

### Release process

1. Developer creates libxmtp branch
2. Node bindings CI compiles new libxmtp into `@xmtp/node-bindings`
3. New bindings package published to npm
4. QA tools updated with new bindings version
5. Tests run against new version

### Switch between versions (manual testing)

If your libxmtp version is already compiled:

1. Find the bindings version containing your libxmtp commit
2. Update mapping in `workers/versions.ts`
3. Point any SDK to that bindings version

```tsx
{
  nodeSDK: "3.2.2",
  nodeBindings: "1.3.1",  // Use existing bindings
  auto: false,               // Manual testing only
}
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
yarn test functional --versions 3  # Test latest 3 auto-enabled versions
yarn test functional --nodeSDK 3.2.2 # custom version
yarn regression  # Vibe check on latest version
```
