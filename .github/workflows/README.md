# GitHub Workflows

This directory contains GitHub Actions workflows for automating testing, deployment, and maintenance processes for the XMTP testing framework. These workflows provide continuous monitoring, performance testing, and quality assurance for XMTP protocol functionality.

## Quick reference

| Workflow                               | Purpose                         | Trigger                      | Key Features                                   |
| -------------------------------------- | ------------------------------- | ---------------------------- | ---------------------------------------------- |
| **Performance.yml**                    | Measure protocol performance    | Every 30 minutes, manual     | Benchmark operation timing and scalability     |
| **Performance-L.yml**                  | Large group performance testing | Every 4 hours, manual        | Test with 100-250 member groups                |
| **AgentHealth.yml**                    | Monitor agent health            | Every 10 minutes, manual     | agent responsiveness and uptime                |
| **Agents.yml**                         | Production agent testing        | Every 4 hours, manual        | Test tagged and untagged agents                |
| **Browser.yml**                        | Browser compatibility testing   | Every 30 minutes, manual     | browser support and functionality              |
| **Delivery.yml**                       | Message delivery reliability    | Every 30 minutes, manual     | Test message loss with 200 streams             |
| **Regression.yml**                     | Library version compatibility   | Every 6 hours, manual        | Test last 3 versions of the library            |
| **Forks.yml**                          | Fork testing on local network   | Every 12 hours, manual       | Daily forks testing with local XMTP network    |
| **NetworkChaos.yml**                   | Network chaos testing           | Daily, manual                | Test network partitions and failures           |
| **Wildcard.yml**                       | Manual PR verification          | Yearly, manual               | Flexible testing for PRs and manual runs       |
| **Deploy.yml**                         | Railway deployment automation   | Version bump in package.json | Auto PR creation and merging for deployments   |
| **validate-package-compatibility.yml** | Package compatibility testing   | Every 5 hours, manual        | Test with different Node versions and managers |
| **validate-agents-repo.yml**           | Agent examples validation       | Hourly, manual               | Clone, build and example agent startup         |
| **validate-qa-repo.yml**               | QA tools validation             | Every 5 hours, manual        | Validate QA tools functionality                |
| **validate-code-quality.yml**          | Code quality enforcement        | On PR to main, manual        | Enforce code quality standards                 |

## Custom Actions

### xmtp-test-setup

Sets up the Node.js environment with caching and installs dependencies for XMTP tests.

**Inputs:**

- `cache-data`: Whether to cache .data and .env files (default: false)
- `test-name`: Name of the test for notifications and artifact naming (required)
- `env`: Test environment (dev, production, etc.) (default: dev)

**Features:**

- Sets up Node.js with version from `.node-version`
- Caches dependencies using yarn.lock hash
- Optionally caches test data (.data and .env files)
- Installs project dependencies

### xmtp-test-cleanup

Handles notifications and artifact uploads for XMTP tests.

**Inputs:**

- `test-name`: Name of the test for notifications and artifact naming (required)
- `env`: Test environment (dev, production, etc.) (required)
- `retention-days`: Number of days to retain artifacts (default: 90)
- `save-to-cache`: Whether to save .data and .env back to cache (default: false)

**Features:**

- Uploads logs and environment files as artifacts
- Uploads installation databases (.data directory)
- Optionally saves processed data back to cache
- Provides detailed cache status information

## Workflow Details

### Performance Testing

- **Performance.yml**: Tests with 5-10 and 50-100 member groups every 30 minutes
- **Performance-L.yml**: Tests with 100-150 and 200-250 member groups every 4 hours
- Both use dev and production environments with DataDog monitoring

### Agent Testing

- **AgentHealth.yml**: Monitors agent health every 10 minutes using agents-dms tests
- **Agents.yml**: Tests both tagged and untagged agents every 4 hours
- All agent tests include Slack notifications on failure

### Network and Chaos Testing

- **NetworkChaos.yml**: Runs daily chaos tests against 4-node XMTP-go cluster
- Tests include: smoketests, DM duplicate prevention, group partitions, node blackholes, key rotation
- **Forks.yml**: Tests fork scenarios on local network every 12 hours

### Validation Workflows

- **validate-package-compatibility.yml**: Tests with Node 20-23 and npm/yarn/yarn1/bun
- **validate-agents-repo.yml**: Validates XMTP agent examples hourly
- **validate-qa-repo.yml**: Validates QA tools every 5 hours
- **validate-code-quality.yml**: Enforces code quality on PRs to main

### Deployment

- **Deploy.yml**: Automatically creates and merges PRs for Railway deployments when package.json version changes

All workflows include comprehensive error handling, artifact uploads, and Slack notifications for failures.
