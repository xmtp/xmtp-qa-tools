[![TS_Performance](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance.yml)
[![TS_Delivery](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery.yml)
[![TS_Gm](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm.yml)

# Overview

This monorepo contains multiple tools for testing and monitoring

## Test suites

Run tests for specific modules using these commands:

- **TS_Performance**: Measures operations by miliseconds and aggregates them in datadog dashboard

  ```bash
  yarn test ts_performance
  ```

  Link to [test](./tests/TS_Performance.test.ts)

- **TS_Delivery**: Test multiple concurrent streams to see if there are message losses

  ```bash
  yarn test ts_delivery
  ```

  Link to [test](./tests/TS_Delivery.test.ts)

- **TS_Gm**: Gm bot E2E test across browser and node

  ```bash
  yarn test ts_gm
  ```

  Link to [test](./tests/TS_Gm.test.ts)

## Workers

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

> [!TIP]
> Repository of 600 dummy wallets with inboxIds [see file](./helpers/generated-inboxes.json)

## Test bot

A bot that tests different interactions for manual testing

```bash
yarn bot
```

See more in the test bot [section](./bots/test/)

## Datadog dashboard

![](/media/ts_performance.png)

- **Delivery Dashboard URL:** [Workflow Dashboard](https://app.datadoghq.com/dashboard/9we-bpa-nzf?fromUser=false&p=1&from_ts=1741437030591&to_ts=1741440630591&live=true)
- **Dashboard URL:** [SDK Performance Dashboard](https://app.datadoghq.com/dashboard/9z2-in4-3we/)

See more in the dashboards [section](./dashboards/)

## Github workflows

See more in the worflows [section](/.github/workflows)

## Helpers

See more helpers in the helpers [section](./helpers/)

## Scripts

See more scripts in the scripts [section](./scripts/)

## Vitest UI

Vitest is used for running tests and provides a UI for better visualization.

> See live link deployed in [railway](https://ephemera-test.up.railway.app/__vitest__/#/)

![](/media/vitest.jpeg)

#### How to run vitest ui

```bash
yarn start
```

## Playwright

Using playwright to write web automations. Try it out:

> See the example xmtp.chat [script](./playwright/gm-bot.playwright.ts)

```tsx
yarn test xmtpchat
```

https://github.com/user-attachments/assets/e7c38c97-a0f3-4402-92ce-4214621e6047

## Bugs

Documenting bugs in this [folder](./bugs/) for easy replicatio.

## Repos

- [lixmtp](https://github.com/xmtp/libxmtp)
- [node-sdk](https://github.com/xmtp/xmtp-js/tree/d7908ad96186026f081309ceb5c608279aab24a5/sdks/browser-sdk)
- [react-native-sdk](https://github.com/xmtp/xmtp-react-native)

## Railway

- xmtp-qa-testing [project](https://railway.com/project/cc97c743-1be5-4ca3-a41d-0109e41ca1fd?environmentId=2d2be2e3-6f54-452c-a33c-522bcdef7792)

## Tracking

See the [QA Board](https://github.com/orgs/xmtp/projects/30)
