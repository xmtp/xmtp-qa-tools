[![TS_Performance](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance.yml)
[![TS_Delivery](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery.yml)
[![TS_Gm](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm.yml)

# XMTP QA Testing Suite

This monorepo contains a comprehensive collection of tools for testing and monitoring the XMTP protocol and its implementations.

## 🧪 Test Suites

Run tests for specific modules using these commands:

- **TS_Performance**: Measures operations in milliseconds and aggregates results in a Datadog dashboard

  ```bash
  yarn test ts_performance
  ```

  [View test source](./tests/TS_Performance.test.ts)

- **TS_Delivery**: Tests multiple concurrent streams to detect any message losses

  ```bash
  yarn test ts_delivery
  ```

  [View test source](./tests/TS_Delivery.test.ts)

- **TS_Gm**: End-to-end testing for the Gm bot across browser and Node.js environments

  ```bash
  yarn test ts_gm
  ```

  [View test source](./tests/TS_Gm.test.ts)

## 👥 Workers

Predefined personas (Bob, Joe, Sam, etc.) are initialized with the `getWorkers` function:

```tsx
let personas: Record<string, Persona>;

beforeAll(async () => {
  personas = await getWorkers(["alice", "bob", "randomguy"], testName);
});

// Use them directly in your tests
convo = await personas.alice.client!.conversations.newDm(
  personas.randomguy.client!.accountAddress,
);
```

### Key Considerations:

- If a persona doesn't exist, its keys are automatically created
- Existing personas use keys from the env file and .data folder
- Missing data folders are created automatically
- Personas with the "random" prefix have keys stored only in memory

> [!TIP]
> Access our repository of 600 dummy wallets with inboxIds in the [generated-inboxes.json](./helpers/generated-inboxes.json) file

## 🤖 Test Bot

A versatile bot for manual interaction testing:

```bash
yarn bot
```

Learn more in the [test bot section](./bots/test/)

## 📊 Datadog Dashboards

![](/media/ts_performance.png)

- **Message Delivery:** [Workflow Dashboard](https://app.datadoghq.com/dashboard/9we-bpa-nzf?fromUser=false&p=1&from_ts=1741437030591&to_ts=1741440630591&live=true)
- **SDK Performance:** [Performance Dashboard](https://app.datadoghq.com/dashboard/9z2-in4-3we/)

Explore more in the [dashboards section](./dashboards/)

## 🔄 GitHub Workflows

See our CI/CD pipeline configuration in the [workflows section](/.github/workflows)

## 🧰 Tools & Utilities

- **Helpers:** Utility functions in the [helpers section](./helpers/)
- **Scripts:** Automation scripts in the [scripts section](./scripts/)

## 🧩 Development Tools

### Vitest UI

We use Vitest for running tests with an interactive UI for better visualization.

> Check out our live deployment on [Railway](https://ephemera-test.up.railway.app/__vitest__/#/)

![](/media/vitest.jpeg)

Run the Vitest UI locally:

```bash
yarn start
```

### Playwright

We use Playwright for web automation testing:

> See our example [xmtp.chat script](./playwright/)

```bash
yarn test xmtpchat
```

https://github.com/user-attachments/assets/e7c38c97-a0f3-4402-92ce-4214621e6047

## 🐛 Bug Tracking

We document bugs in the [bugs folder](./bugs/) for easy reproduction and tracking.

## 📚 Related Repositories

- [libxmtp](https://github.com/xmtp/libxmtp) - Core library implementation
- [node-sdk](https://github.com/xmtp/xmtp-js/tree/d7908ad96186026f081309ceb5c608279aab24a5/sdks/node-sdk) - Node.js SDK
- [react-native-sdk](https://github.com/xmtp/xmtp-react-native) - React Native implementation

## 🚂 Railway Deployment

- [xmtp-qa-testing project](https://railway.com/project/cc97c743-1be5-4ca3-a41d-0109e41ca1fd?environmentId=2d2be2e3-6f54-452c-a33c-522bcdef7792)

## 📋 Issue Tracking

Follow our progress on the [QA Board](https://github.com/orgs/xmtp/projects/30)

- [Issues](https://github.com/xmtp/xmtp-qa-testing/issues)
