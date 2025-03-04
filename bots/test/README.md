# XMTP Agent Testing for React Native

A lightweight toolkit for React Native developers to test messaging functionality against XMTP agents.

## Getting Started

### Prerequisites

- Node.js (v16+)
- Yarn or npm
- Git

### Installation

```bash
git clone https://github.com/your-org/qa-testing
cd qa-testing
yarn install
yarn bot test
```

## Running the Agent Locally

If you need to run the test agent locally:

```bash
yarn bot test
```

This will return the address of the bot

![](/media/test.png)

In the example the public key is `0x6Cb6aA63AA37E42B4741430cE6a5A8d236C1b14F`

## Available Commands

| Command  | Description                                                                          |
| -------- | ------------------------------------------------------------------------------------ |
| `gm`     | Returns gm to your messageCreates a test group with simulated users and conversation |
| `/group` | Creates a test group with simulated users and conversation                           |

## Users

The test agent is populated with the following virtual users:

- **Alice**: Regular user
- **Joe**: Regular user
- **Sam**: Regular user
- **Bob**: Admin user (optional)

This will start the agent on your local machine, ready to respond to messages.

## Environment Configuration

Create a `.env` file with the following configuration:

```bash
LOGGING_LEVEL="off" # off, error, warn, info, debug, trace
XMTP_ENV="dev" # dev, production
```

## Coming Soon

- [ ] Metadata for groups
- [ ] Consent
- [ ] Stress tests
