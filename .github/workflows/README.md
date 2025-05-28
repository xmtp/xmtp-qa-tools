# 🔄 GitHub Workflows

This directory contains GitHub Actions workflows for automating testing, deployment, and maintenance processes for the XMTP testing framework. These workflows provide continuous monitoring, performance testing, and quality assurance for XMTP protocol functionality.

## Quick reference

| Workflow                      | Purpose                           | Trigger                      | Key Features                                   |
| ----------------------------- | --------------------------------- | ---------------------------- | ---------------------------------------------- |
| **AgentExamplesRepo.yml**     | Validate XMTP agent examples      | Hourly, manual               | Clone, build and verify example agent startup  |
| **Deploy.yml**                | Handle Railway deployments        | Version bump in package.json | Auto PR creation and merging for deployments   |
| **Agents.yml**                | Monitor production agent health   | Hourly, manual               | Verify agent responsiveness and uptime         |
| **Gm.yml**                    | Test GM bot functionality         | Every 30 minutes, manual     | Verify GM bot responses and performance        |
| **Delivery.yml**              | Test message delivery reliability | Every 30 minutes, manual     | Verify cross-environment message delivery      |
| **Large.yml**                 | Test large scale operations       | Every 2 hours, manual        | Test large group operations and scalability    |
| **Performance.yml**           | Measure protocol performance      | Every 30 minutes, manual     | Benchmark operation timing and scalability     |
| **GroupStress.yml**           | Group stress testing              | PR to main, manual           | Test group membership changes under stress     |
| **PackageCompatibility.yml**  | Verify package compatibility      | On main branch push, manual  | Test with different Node versions and managers |
| **upload-installations.yml**  | Backup installation data          | Daily, manual                | Upload keys and installation data as artifacts |
| **validate-code-quality.yml** | Check code quality                | On non-main branch pushes    | Enforce code quality standards                 |

## Usage

GitHub Actions workflows run automatically based on their triggers, but can also be manually initiated from the "Actions" tab in the GitHub repository.

```bash
# To trigger a workflow manually via GitHub CLI:
gh workflow run workflow-name.yml

# Example - run the agent health check:
gh workflow run Agents.yml
```

## 🤖 Agent Health Monitoring

The `Agents.yml` workflow monitors the health and responsiveness of XMTP agents in production.

```yaml
name: Agents
on:
  schedule:
    - cron: "10 * * * *" # Runs at 10 minutes past each hour
  workflow_dispatch:

jobs:
  test:
    # ...
    steps:
      # ...
      - name: Run tests with retry
        run: yarn retry agents
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
- `OPENAI_API_KEY`: OpenAI API key for AI-powered testing
- `SLACK_BOT_TOKEN`: Slack bot token for notifications
- `WALLET_KEY`: XMTP wallet private key for testing
- `ENCRYPTION_KEY`: XMTP encryption key for database
- `SLACK_CHANNEL`: Slack channel for notifications (optional, defaults to 'xmtp-qa')

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
4. **Slack Notifications**: Real-time workflow status updates
5. **Email Notifications**: Configurable for workflow failures

### Test Categories

The workflows are organized into logical categories:

- **🤖 Automated Tests**: `Agents.yml`, `Gm.yml` - Continuous monitoring
- **📊 Metrics Tests**: `Delivery.yml`, `Large.yml`, `Performance.yml` - Performance measurement
- **🚨 Stress Tests**: `GroupStress.yml` - High-load scenario testing
- **🔧 Infrastructure**: `Deploy.yml`, `PackageCompatibility.yml` - Deployment and compatibility

## 📝 Best practices

When working with these workflows, consider the following best practices:

1. **Secrets management**: Never hardcode secrets; use GitHub's secrets store
2. **Workflow isolation**: Design workflows to run independently
3. **Artifact cleanup**: Configure appropriate retention policies
4. **Concurrency limits**: Avoid excessive parallel executions
5. **Timeout configuration**: Set appropriate timeouts to prevent hung jobs

## 🔄 Recent Changes

The workflows have been updated to use standardized naming conventions:

| Old Name            | New Name          | Test Command             |
| ------------------- | ----------------- | ------------------------ |
| `at_agents.yml`     | `Agents.yml`      | `yarn retry agents`      |
| `at_gm.yml`         | `Gm.yml`          | `yarn retry gm`          |
| `m_delivery.yml`    | `Delivery.yml`    | `yarn retry delivery`    |
| `m_performance.yml` | `Performance.yml` | `yarn retry performance` |
| `m_large.yml`       | `Large.yml`       | `yarn large`             |
| `StressGroup.yml`   | `GroupStress.yml` | `yarn retry not-forked`  |

All test suites now follow consistent kebab-case naming conventions for better organization and maintainability.
