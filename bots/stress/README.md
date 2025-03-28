# 🤖 Stress bot

A lightweight toolkit for app developers to test messaging functionality against XMTP bots.

### Prerequisites

- Node.js (20.18.0)
- Yarn

### Installation

```bash
git clone https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
# Run the bot
yarn bot:stress
```

## 💬 Available Commands

| Command            | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `/stress [number]` | Start a stress test with the specified number of workers |
| `/stress reset`    | Terminate all workers and start over                     |

## ⚙️ Environment Configuration

Create a `.env` file with the following configuration:

```bash
LOGGING_LEVEL="off" # off, error, warn, info, debug, trace
XMTP_ENV="dev" # dev, production
OPENAI_API_KEY="sk-proj-..." # OpenAI API key
```

## 🧪 Considerations

- If a worker does not exist, its keys are created.
- If worker exists uses the existing env file keys and .data folder
- If the data folder doesnt exist, it creates one
- Workers prefixed with "random" have keys that are stored only in memory.

## Test Environment

- Device: [iPhone 16 Pro Max]
- Network: [Wifi]
- XMTP Environment: [dev]
- App Version: [1.0.0]

## Stress Test Verification Matrix

| Test Scenario | Workers | App Launch | Message Loading | UI Performance | Stream Status | Message Sending | Status | Notes |
| ------------- | ------- | ---------- | --------------- | -------------- | ------------- | --------------- | ------ | ----- |
| Light Load    | 5       | < 2s       | Instant         | No Lag         | Connected     | Instant         | ⬜     |       |
| Medium Load   | 10      | < 3s       | < 1s            | Minimal Lag    | Connected     | < 1s            | ⬜     |       |
| Heavy Load    | 20      | < 4s       | < 2s            | Acceptable     | Connected     | < 2s            | ⬜     |       |
| Extreme Load  | 50      | < 5s       | < 3s            | Responsive     | Connected     | < 3s            | ⬜     |       |

## Legend

- ⬜ Not Tested
- ✅ Passed
- ❌ Failed
- ⚠️ Partial Pass

## Test Execution Log

| Date | Tester | Environment | Notes |
| ---- | ------ | ----------- | ----- |
|      |        |             |       |

### Resources

- **Local:** Work in local network with [dev section](/dev/)
- **Workers:** Predefined workers like `bob`, `alice`, `randomguy` with [workers](/workers/)
- **Helpers:** Utility functions in the [helpers section](/helpers/)
- **Scripts:** Automation scripts in the [scripts section](/scripts/)
