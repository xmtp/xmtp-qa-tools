# 🔄 GitHub Workflows

This directory contains GitHub Actions workflows for automating testing, deployment, and maintenance processes for the XMTP testing framework.

## Quick reference

| Workflow                           | Purpose                                | Trigger                      | Key Features                                   |
| ---------------------------------- | -------------------------------------- | ---------------------------- | ---------------------------------------------- |
| **check-agent-examples.yml**       | Validate XMTP agent examples           | Hourly, manual               | Clone, build and verify example agent startup  |
| **Deploy.yml**                     | Handle Railway deployments             | Version bump in package.json | Auto PR creation and merging for deployments   |
| **TS_AgentHealth.yml**             | Monitor production agent health        | Every 30 minutes, manual     | Verify agent responsiveness and uptime         |
| **TS_Delivery.yml**                | Test message delivery reliability      | Scheduled, manual            | Verify cross-environment message delivery      |
| **TS_Geolocation.yml**             | Test regional network performance      | Every 30 minutes, manual     | Run tests from multiple geographic regions     |
| **TS_Gm.yml**                      | Validate basic messaging functionality | Scheduled, manual            | Verify core protocol operations                |
| **TS_Performance.yml**             | Measure protocol performance           | Scheduled, manual            | Benchmark operation timing and scalability     |
| **test-package-compatibility.yml** | Verify package compatibility           | On main branch push, manual  | Test with different Node versions and managers |
| **upload-installations.yml**       | Backup installation data               | Daily, manual                | Upload keys and installation data as artifacts |
| **validate-code-quality.yml**      | Check code quality                     | On non-main branch pushes    | Enforce code quality standards                 |
| **validate-functional-tests.yml**  | Run functional test suite              | On non-main branch pushes    | Ensure tests work before merging               |

## Usage

GitHub Actions workflows run automatically based on their triggers, but can also be manually initiated from the "Actions" tab in the GitHub repository.

```bash
# To trigger a workflow manually via GitHub CLI:
gh workflow run workflow-name.yml

# Example - run the agent health check:
gh workflow run TS_AgentHealth.yml
```

## 🤖 Agent Health Monitoring

The `TS_AgentHealth.yml` workflow monitors the health and responsiveness of XMTP agents in production.

```yaml
name: TS_AgentHealth
on:
  schedule:
    - cron: "15,45 * * * *" # Runs at 15 and 45 minutes past each hour
  workflow_dispatch:

jobs:
  test:
    # ...
    steps:
      # ...
      - name: Run tests with retry
        run: ./scripts/run-test.sh TS_AgentHealth
```

**Key features:**

- Regular execution to ensure agent uptime
- Automatic artifact upload for diagnostics
- Test reporting via Datadog metrics
- Response time tracking

## 🚂 Deployment Automation

The `Deploy.yml` workflow automates Railway deployments when version bumps are detected.

```yaml
name: Railway Deploy
on:
  push:
    branches:
      - main
    paths:
      - "package.json"

jobs:
  detect-version-bump:
    # ...
  create-and-merge-pr:
    # ...
    steps:
      # ...
      - name: Create deployment branch
        # ...
      - name: Create PR
        # ...
      - name: Auto-merge PR
        # ...
```

**Key features:**

- Automatic version detection
- Deployment PR creation
- Auto-merge capability
- Deployment metadata tracking

## 📊 Geographic Performance Testing

The `TS_Geolocation.yml` workflow tests XMTP performance across different global regions.

```yaml
name: TS_Geolocation
strategy:
  matrix:
    environment: [dev, production]
    region: [us-west, us-east, europe, asia]
```

**Key features:**

- Multi-region testing (US, Europe, Asia)
- Environment matrix for dev/production testing
- Performance benchmarking by region
- Automated artifact collection

## 🧪 Functional Test Validation

The `validate-functional-tests.yml` workflow ensures that functional tests pass on all PRs.

```yaml
name: Validate functional tests
on:
  push:
    branches-ignore: [main]

jobs:
  check:
    # ...
    steps:
      # ...
      - name: Run functional tests
        run: ./scripts/run-test.sh functional
```

**Key features:**

- Automated test execution for PRs
- Local development environment startup
- Test result logging
- Artifact collection for debugging

## 📦 Package Compatibility Testing

The `test-package-compatibility.yml` workflow verifies compatibility across environments.

```yaml
name: Package Compatibility
strategy:
  matrix:
    node-version: [20, 21, 22, 23]
    package-manager: [npm, yarn, yarn1, pnpm, bun]
```

**Key features:**

- Node.js version matrix testing
- Multiple package manager verification
- Build and client check validation
- Comprehensive environment coverage

## 💾 Installation Data Backup

The `upload-installations.yml` workflow backs up installation data and keys.

```yaml
name: Upload Installations & Keys
on:
  schedule:
    - cron: "0 0 * * *" # Run at midnight UTC every day
  workflow_dispatch:
```

**Key features:**

- Daily automated backups
- Key and installation data preservation
- Long-term artifact retention (365 days)
- Environment variable capture

## 📝 Configuration

Workflows are configured using GitHub repository secrets and variables:

### Secrets

- `DATADOG_API_KEY`: API key for metrics reporting
- `RAILWAY_TOKEN`: Authentication for Railway operations
- `WALLET_KEY`: XMTP wallet private key for testing
- `ENCRYPTION_KEY`: XMTP encryption key for database

### Variables

- `LOGGING_LEVEL`: Controls log verbosity
- `XMTP_ENV`: Target XMTP environment (dev/production)
- `GEOLOCATION`: Target geographic region
- `BATCH_SIZE`: Number of participants per batch
- `MAX_GROUP_SIZE`: Maximum group size for testing

## 📊 Monitoring and Reporting

Workflow results are accessible through multiple channels:

1. **GitHub Actions UI**: Real-time execution logs and status
2. **Artifacts**: Uploaded test reports and debug information
3. **Datadog**: Performance metrics and test results
4. **Email Notifications**: Configurable for workflow failures

## 📝 Best practices

When working with these workflows, consider the following best practices:

1. **Secrets management**: Never hardcode secrets; use GitHub's secrets store
2. **Workflow isolation**: Design workflows to run independently
3. **Artifact cleanup**: Configure appropriate retention policies
4. **Concurrency limits**: Avoid excessive parallel executions
5. **Timeout configuration**: Set appropriate timeouts to prevent hung jobs
