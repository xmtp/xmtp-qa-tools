# Contributing

We appreciate your contributions! Here’s how to add new templates or examples quickly:

## Getting started

```bash
# clone the repository
git clone https://github.com/ephemeraHQ/xmtp-agents/
cd xmtp-agents

# install dependencies
yarn install
# build
yarn build

# run sample agents from the examples directory
yarn examples

# or run a specific example
yarn examples gm
```

> This runs the base agent locally. You can also launch specific examples via `yarn examples`.

## Repo structure

```
xmtp-agents/
├── packages/
│   ├── agent-starter
│   └── resolver
└── examples/
    ├── gated-group
    └── ... [your new example here]
```

- **packages**: core libraries (`agent-starter`, `resolver`).
- **examples**: standalone demos (e.g., `gated-group`).

## Adding an example

1. Create a new folder under `examples/`.
2. Include a minimal README.md describing what it does and how to run it.
3. Validate locally with `yarn examples your-example-name`.

## Submitting a PR

1. Open a PR against `main`.
2. Briefly describe the purpose of your example or changes.
3. Wait for reviews/feedback, then merge once approved.

Thank you for contributing! Feel free to open an issue if you have questions or need help.
