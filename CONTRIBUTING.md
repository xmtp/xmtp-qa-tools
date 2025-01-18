# Contributing

Templates help developers quickly bootstrap new agents. Here's how to contribute a template:

### Run locally

```bash
git clone https://github.com/ephemeraHQ/xmtp-agents/
cd xmtp-agents
```

Run it:

```bash
yarn install
yarn dev
```

### Structure

Make it work in the playground:

```tsx
xmtp-agents/
└── packages/
    └── agent-starter
    └── resolver
└── examples/
    └── gated-group
    // ... add your more examples
```

### Create example

Create a example like [gated-group].

### Create a PR

Create a PR about your example

- Wait until is merged!
