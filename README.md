# Monorepo Overview

This monorepo contains multiple projects and tools for development and testing. The following sections provide straightforward instructions to set up, test, and configure the components.

## Prerequisites

- Install [Yarn](https://yarnpkg.com/).
- Clone the repository and change to its root directory.

## Installation

Run this command to install all dependencies:

```bash
yarn install
```

## Testing

Run tests for specific modules using these commands:

- **Direct Messages (DMs):**

  ```bash
  yarn test dms
  ```

- **Streams:**

  ```bash
  yarn test streams
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
  [bob, joe, sam] = await getWorkers(["bob", "joe", "sam"], env, testName);
});
```

> If a persona does not exist, its keys are created. Personas prefixed with "random" have keys that are stored only in memory.

## Bot Setup

Run bots using these commands:

- **GM Bot:**

  A bot that replies gm

  ```bash
  yarn bot gm
  ```

- **Test Bot:**

  A bot that generates some groups for you

  ```bash
  yarn bot test
  ```

## Custom Key Generation

Generate custom keys with:

```bash
yarn gen:keys [name]
```

Replace `[name]` with the desired identifier.

Example:

```bash
# alice
WALLET_KEY_ALICE=0x...
ENCRYPTION_KEY_ALICE=
# public key is 0x7788b23377c368B571D6ce4DA9B54670409A96d0
# joe
WALLET_KEY_JOE=
ENCRYPTION_KEY_JOE=
# public key is 0x54469Ef3f6a4e511DA71795D90E7BbC9A4845EE9
```

## GitHub Workflows

The monorepo includes automated workflows using GitHub Actions to ensure continuous integration and testing:

- **Scheduled Test Workflow**: Defined in `streams.yml`, this workflow runs tests for the streams module every two hours and can also be triggered manually.

This brief mention provides an overview without going into detailed steps, keeping the README succinct.

## Environment Configuration

A `.env` file manages environment variables. Use the `.env.example` file as a template. Key variables include:

- **API Keys:**

  - ALCHEMY_API_KEY: For the gated group bot
  - OPENAI_API_KEY: For the gpt bot

- **Wallet and Encryption Keys:**  
  For identities such as Bob, Alice, Joe, Fabri, Elon, Sam, and Bot (e.g., `WALLET_KEY_[NAME]` and `ENCRYPTION_KEY_[NAME]`).
