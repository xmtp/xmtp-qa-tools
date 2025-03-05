[![TS_Performance](https://github.com/ephemeraHQ/qa-testing/actions/workflows/TS_Performance.yml/badge.svg)](https://github.com/ephemeraHQ/qa-testing/actions/workflows/TS_Performance.yml)
[![TS_Delivery](https://github.com/ephemeraHQ/qa-testing/actions/workflows/TS_Delivery.yml/badge.svg)](https://github.com/ephemeraHQ/qa-testing/actions/workflows/TS_Delivery.yml)
[![TS_GM_bot](https://github.com/ephemeraHQ/qa-testing/actions/workflows/TS_GM_bot.yml/badge.svg)](https://github.com/ephemeraHQ/qa-testing/actions/workflows/TS_GM_bot.yml)

# Overview

This monorepo contains multiple projects and tools for development and testing.

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

- **TS_Forked**: Stress tests group operations to find if they are forked

  ```bash
  yarn test ts_forked
  ```

  Link to [test](./tests/TS_Forked.test.ts)

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

![](/media/datadog.png)

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
