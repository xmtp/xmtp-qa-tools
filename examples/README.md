# Examples

Here, you will find various examples and tutorials to help you get started with creating and deploying your own agents using XMTP.

- [gated-group](/examples/gated-group/): Create a gated group chat that verifies NFT ownership using Alchemy.
- [gm](/examples/gm/): A simple agent that replies with "GM".
- [gpt](/examples/gpt): A simple agent that interacts with OpenAI APIs.
- [express](/examples/express/): Communicate with traditional api endpoints using xmtp e2ee
- [railway](/examples/railway/): A tutorial on how to deploy your agent on Railway.
- [replit](/examples/replit/): A tutorial on how to deploy your agent on Replit.

## Development

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

Use a `.env` file for your environment variables:

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # a second random 32 bytes encryption key for local db encryptioney for encryption (can be random)
```

## Contribute

We welcome contributions! Check out the [contributing](CONTRIBUTING.md) file for more information on how to get started.
