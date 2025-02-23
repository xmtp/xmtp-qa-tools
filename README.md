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

? If a persona does not exist, its keys are created. Personas prefixed with "random" have keys that are stored only in memory.

## Bot Setup

Run bots using these commands:

- **GM Bot:**

  ```bash
  yarn bot gm
  ```

- **GPT Bot:**

  ```bash
  yarn bot gpt
  ```

## Custom Key Generation

Generate custom keys with:

```bash
yarn gen:keys [name]
```

Replace `[name]` with the desired identifier.

Here's a concise section about the GitHub workflows for your README:

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
