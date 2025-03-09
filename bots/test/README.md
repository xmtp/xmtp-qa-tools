# 🤖 Test bot

A lightweight toolkit for app developers to test messaging functionality against XMTP bots.

> Send a message to `0x5348Ca464c55856AcfEE5F4490d12BF51D24B01F`

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

| Command                | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `gm`                   | Returns gm to your message                                   |
| `/create [5]`          | Creates a test group with simulated users and conversation   |
| `/rename [name]`       | Rename the current group                                     |
| `/add [name]`          | Add the name of a persona to the group                       |
| `/remove [name]`       | Remove the name of a persona from the group                  |
| `/groups`              | List all active groups                                       |
| `/members`             | List all members in the current group                        |
| `/broadcast [message]` | Broadcast a message to all participants in the current group |
| `/leave`               | Leave the current group                                      |
| `/info`                | Get info about the current group                             |
| `/workers`             | List all available workers                                   |

## ⚙️ Environment Configuration

Create a `.env` file with the following configuration:

```bash
LOGGING_LEVEL="off" # off, error, warn, info, debug, trace
XMTP_ENV="dev" # dev, production
OPENAI_API_KEY="sk-proj-..." # OpenAI API key
```

## 🧰 Workers

Predefined personas like Bob, Joe, and Sam are initialized with the `getWorkers` function. For example:

```
const names = [
  "bob",
  "alice",
  "fabri",
  "bot",
  "elon",
  "joe",
  "charlie",
  "dave",
  "rosalie",
  "eve",
  "frank",
  "grace",
  "henry",
  "ivy",
  "jack",
  "karen",
  "larry",
  "mary",
  "nancy",
  "oscar",
  "paul",
]

const personas = await getWorkers(names, testName);
```

Considerations

- If a persona does not exist, its keys are created.
- If persona exists uses the existing env file keys and .data folder
- If the data folder doesnt exist, it creates one
- Personas prefixed with "random" have keys that are stored only in memory.

```

```
