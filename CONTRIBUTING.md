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
message-kit/
└── packages/
    └── agent-starter
    └── resolver
└── recipes/
    └── gated-group
    // ... add your more recipes
```

### Create recipe

Create a recipe like [gated-group].

### Create a PR

Create a PR about your recipe

- Wait until is merged!
