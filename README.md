# Overview

[![TS_Streams](https://github.com/ephemeraHQ/qa-testing/actions/workflows/TS_Streams.yml/badge.svg)](https://github.com/ephemeraHQ/qa-testing/actions/workflows/TS_Streams.yml)
[![TS_Performance](https://github.com/ephemeraHQ/qa-testing/actions/workflows/TS_Performance.yml/badge.svg)](https://github.com/ephemeraHQ/qa-testing/actions/workflows/TS_Performance.yml)
[![TS_Loss](https://github.com/ephemeraHQ/qa-testing/actions/workflows/TS_Loss.yml/badge.svg)](https://github.com/ephemeraHQ/qa-testing/actions/workflows/TS_Loss.yml)
[![TS_GM_bot](https://github.com/ephemeraHQ/qa-testing/actions/workflows/TS_GM_bot.yml/badge.svg)](https://github.com/ephemeraHQ/qa-testing/actions/workflows/TS_GM_bot.yml)

This monorepo contains multiple projects and tools for development and testing. The following sections provide straightforward instructions to set up, test, and configure the components.

## Prerequisites

- Yarn 4.6.0
- Clone the repository and change to its root directory.

## Installation

Run this command to install all dependencies:

```bash
yarn install
```

## Testing

Run tests for specific modules using these commands:

- **Direct Messages (DMs):**: Sending dms

  ```bash
  yarn test dms
  ```

- **Streams:**: 3 different kind of streams

  ```bash
  yarn test streams
  ```

- **Groups:**: Up to 500 groups

  ```bash
  yarn test groups
  ```

- **Groups:**

  ```bash
  yarn test groups
  ```

#### Vitest UI Setup

Vitest is used for running tests and provides a UI for better visualization.

```bash
yarn start
```

## Worker Setup

The repository uses a worker system to manage test personas.

### Known Workers

Predefined personas like Bob, Joe, and Sam are initialized with the `getWorkers` function. For example:

```typescript
import { getWorkers, type Persona } from "../helpers/workers/creator";

let bob: Persona;
let joe: Persona;
let sam: Persona;

beforeAll(async () => {
  [bob, joe, sam] = await getWorkers(["bob", "joe", "sam"], testName);
});
```

Considerations

- If a persona does not exist, its keys are created.
- If persona exists uses the existing env file keys and .data folder
- If the data folder doesnt exist, it creates one
- Personas prefixed with "random" have keys that are stored only in memory.

> [!TIP]
> Repository of 600 dummy wallets with inboxIds [see file](./helpers/generated-inboxes.json)

## Test Bot:

A bot that generates some groups for you

```bash
yarn bot test
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
