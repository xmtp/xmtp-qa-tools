# 🤖 XMTP Bot Testing for React Native and Browser

A lightweight toolkit for React Native developers to test messaging functionality against XMTP bots.

## 🚀 Getting Started

### Prerequisites

- Node.js (20.18.0)
- Yarn

### Installation

```bash
git clone https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

## 🏃‍♂️ Running the Bot

If you need to run the test bot locally:

```bash
yarn bot
```

This will return the address of the bot

![](/media/test.png)

In the example the public key is `0x6Cb6aA63AA37E42B4741430cE6a5A8d236C1b14F`

## 💬 Available Commands

| Command  | Description                                                |
| -------- | ---------------------------------------------------------- |
| `gm`     | Returns gm to your message                                 |
| `/group` | Creates a test group with simulated users and conversation |

## 👥 Users

The test bot is populated with the following virtual users:

- **Alice**: Regular user
- **Joe**: Regular user
- **Sam**: Regular user
- **Bob**: Admin user (optional)

This will start the bot on your local machine, ready to respond to messages.

## ⚙️ Environment Configuration

Create a `.env` file with the following configuration:

```bash
LOGGING_LEVEL="off" # off, error, warn, info, debug, trace
XMTP_ENV="dev" # dev, production
```

## 🧰 Workers

Predefined personas like Bob, Joe, and Sam are initialized with the `getWorkers` function. For example:

```tsx
let personas: Record<string, Persona>;

beforeAll(async () => {
  personas = await getWorkers(["alice", "bob", "randomguy"], testName);
});

// Use them directly
convo = await personas.alice.client!.conversations.newDm(
  personas.randomguy.client!.accountAddress,
);
```

Considerations

- If a persona does not exist, its keys are created.
- If persona exists uses the existing env file keys and .data folder
- If the data folder doesnt exist, it creates one
- Personas prefixed with "random" have keys that are stored only in memory.

## 🔮 Coming Soon

- [ ] Metadata for groups
- [ ] Consent
- [ ] Stress tests
