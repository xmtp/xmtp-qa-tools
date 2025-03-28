# 🤖 XMTP Stress Bot

A lightweight toolkit for app developers to test messaging functionality against XMTP bots.

## 📋 Prerequisites

- Node.js (20.18.0)
- Yarn

## 🔧 Installation

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
LOGGING_LEVEL="off"      # Options: off, error, warn, info, debug, trace
XMTP_ENV="dev"           # Options: dev, production
OPENAI_API_KEY="sk-proj-..."  # OpenAI API key
```

## 🧪 Worker Behavior

- New workers have their keys automatically created
- Existing workers use their stored keys from the env file and .data folder
- If the data folder doesn't exist, one is created automatically
- Workers prefixed with "random" have keys that are stored only in memory

## 📱 Test Environment Specification

| Parameter        | Value             |
| ---------------- | ----------------- |
| Device           | iPhone 16 Pro Max |
| Network          | WiFi              |
| XMTP Environment | dev               |
| App Version      | 1.0.0             |

## 🔍 Stress Test Verification Matrix

| Workers | Messages | App Launch | Message Loading | UI Performance | Stream Status | Message Sending | Status | Notes                             |
| ------- | -------- | ---------- | --------------- | -------------- | ------------- | --------------- | ------ | --------------------------------- |
| 5       | 5        | < 2s       | Instant         | No Lag         | Connected     | Instant         | ✅     |                                   |
| 10      | 5        | < 3s       | < 1s            | Minimal Lag    | Connected     | < 1s            | ⚠️     | Fast launch, fail sending, lag UX |
| 20      | 5        | < 4s       | < 2s            | Acceptable     | Connected     | < 2s            | ❌     |                                   |
| 30      | 5        | < 5s       | < 3s            | Responsive     | Connected     | < 3s            | ❌     |                                   |

## 📂 Project Structure

- **Local:** Working in local network with resources in the [dev](/dev/) directory
- **Workers:** Predefined workers like `bob`, `alice`, `randomguy` in the [workers](/workers/) directory
- **Helpers:** Utility functions in the [helpers](/helpers/) directory
- **Scripts:** Automation scripts in the [scripts](/scripts/) directory
