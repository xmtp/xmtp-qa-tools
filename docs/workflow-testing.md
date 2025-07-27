# Workflow Testing Guide

This guide explains how to test GitHub Actions workflows safely without pushing to the main branch or affecting production systems.

## Overview

We've implemented several strategies to test workflows in a sandbox environment:

1. **Dedicated Testing Branch** - Long-lived branch for safe workflow testing
2. **Testing Workflow** - Comprehensive workflow for testing different scenarios
3. **Helper Script** - Automated tools to manage testing workflow
4. **Selective PR Testing** - Enable/disable PR triggers on demand

## Quick Start

### 1. Setup Testing Environment

```bash
# Setup the testing branch and environment
./scripts/workflow-testing.sh setup
```

### 2. Test Workflows

```bash
# Test specific workflow types
./scripts/workflow-testing.sh test functional
./scripts/workflow-testing.sh test performance
./scripts/workflow-testing.sh test all

# Push changes to trigger automatic testing
./scripts/workflow-testing.sh push
```

### 3. Monitor Results

```bash
# Check testing status
./scripts/workflow-testing.sh status

# Or view in GitHub Actions
# https://github.com/your-org/your-repo/actions
```

## Testing Strategies

### Strategy 1: Dedicated Testing Branch

**Branch Name:** `workflow-testing`

**How it works:**
- Long-lived branch that stays in sync with main
- Workflows are configured to trigger on this branch
- Safe place to test workflow changes without affecting main
- Can be used for both automatic and manual testing

**Advantages:**
- ✅ Complete isolation from main branch
- ✅ No risk to production workflows
- ✅ Can test complex workflow interactions
- ✅ Supports both push and PR testing

**Usage:**
```bash
# Setup (one time)
./scripts/workflow-testing.sh setup

# Make workflow changes, then push to test
git checkout workflow-testing
# ... make changes ...
./scripts/workflow-testing.sh push
```

### Strategy 2: Testing Workflow

**File:** `.github/workflows/workflow-testing.yml`

**How it works:**
- Dedicated workflow that mimics production workflows
- Supports multiple test types via manual dispatch
- Runs on testing branch automatically
- Provides comprehensive test coverage

**Features:**
- Multiple test types (functional, performance, agents, etc.)
- Environment selection (dev, production)
- Conditional execution based on inputs
- Comprehensive test summary

**Usage:**
```bash
# Manual trigger with specific test type
./scripts/workflow-testing.sh test performance

# Automatic trigger on push to testing branch
git push origin workflow-testing
```

### Strategy 3: Selective PR Testing

**How it works:**
- Enable PR testing on specific workflows when needed
- Quickly enable/disable to control test scope
- Useful for testing specific workflow changes

**Usage:**
```bash
# Enable PR testing for specific workflow
./scripts/workflow-testing.sh enable-pr-tests Performance.yml

# Disable PR testing
./scripts/workflow-testing.sh disable-pr-tests Performance.yml

# Disable all PR testing
./scripts/workflow-testing.sh disable-pr-tests
```

### Strategy 4: Fork Testing

**How it works:**
- Fork the repository to your personal account
- Test workflows in your fork without affecting the main repo
- Useful for major workflow restructuring

**Steps:**
1. Fork the repository on GitHub
2. Clone your fork locally
3. Make workflow changes
4. Push to your fork to test
5. Create PR when ready

## Testing Scenarios

### Scenario 1: New Workflow Development

```bash
# 1. Setup testing environment
./scripts/workflow-testing.sh setup

# 2. Create new workflow file
# Edit .github/workflows/new-workflow.yml

# 3. Test the new workflow
git add .github/workflows/new-workflow.yml
./scripts/workflow-testing.sh push

# 4. Monitor results
./scripts/workflow-testing.sh status
```

### Scenario 2: Modifying Existing Workflows

```bash
# 1. Switch to testing branch
git checkout workflow-testing

# 2. Modify existing workflow
# Edit .github/workflows/Performance.yml

# 3. Test changes
./scripts/workflow-testing.sh push

# 4. Compare with main branch behavior
git diff main..workflow-testing .github/workflows/
```

### Scenario 3: Testing PR Triggers

```bash
# 1. Enable PR testing for specific workflow
./scripts/workflow-testing.sh enable-pr-tests Functional.yml

# 2. Create test PR against testing branch
git checkout -b feature/test-pr-triggers
# ... make changes ...
git push origin feature/test-pr-triggers

# 3. Create PR: feature/test-pr-triggers -> workflow-testing
# This will trigger the workflow safely

# 4. Disable PR testing when done
./scripts/workflow-testing.sh disable-pr-tests Functional.yml
```

### Scenario 4: Testing Workflow Dependencies

```bash
# 1. Setup testing environment
./scripts/workflow-testing.sh setup

# 2. Test all workflows together
./scripts/workflow-testing.sh test all

# 3. Check for conflicts or dependency issues
./scripts/workflow-testing.sh status
```

## Best Practices

### 1. Isolation
- Always test on the `workflow-testing` branch first
- Never enable PR testing on main without thorough testing
- Use dev environment for testing when possible

### 2. Incremental Testing
- Test one workflow change at a time
- Use specific test types rather than testing everything
- Monitor resource usage and execution time

### 3. Documentation
- Document workflow changes clearly
- Update this guide when adding new testing strategies
- Include test results in PR descriptions

### 4. Cleanup
- Regularly sync testing branch with main
- Clean up test artifacts and logs
- Remove testing configurations before merging to main

## Monitoring and Debugging

### GitHub Actions UI
- Navigate to: `https://github.com/your-org/your-repo/actions`
- Filter by branch: `workflow-testing`
- Check workflow runs and logs

### Command Line Monitoring
```bash
# Install GitHub CLI if not available
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh

# Monitor workflow runs
gh run list --branch=workflow-testing
gh run view --log <run-id>
```

### Debugging Failed Workflows
```bash
# Check recent failures
gh run list --status=failure --limit=5

# View specific failure details
gh run view <run-id> --log

# Re-run failed workflow
gh run rerun <run-id>
```

## Security Considerations

### Secrets and Environment Variables
- Testing workflows have access to the same secrets as production
- Use dev environment variables when possible
- Avoid testing with production data

### Branch Protection
- Consider adding branch protection to `workflow-testing`
- Require reviews for workflow changes
- Use status checks to prevent broken workflows

### Resource Limits
- Monitor GitHub Actions usage and costs
- Set timeouts on testing workflows
- Use `fail-fast: false` judiciously

## Troubleshooting

### Common Issues

**Issue: Testing branch out of sync**
```bash
git checkout workflow-testing
git pull origin main --no-edit
git push origin workflow-testing
```

**Issue: Workflow not triggering**
- Check workflow syntax with `gh workflow list`
- Verify trigger conditions
- Check branch protection rules

**Issue: Too many workflow runs**
- Use specific test types instead of testing all
- Disable automatic triggers temporarily
- Clean up old workflow runs

**Issue: Permission errors**
- Check repository secrets and variables
- Verify workflow permissions in settings
- Ensure proper GitHub token permissions

## Migration Guide

### From No Testing to Testing Branch
1. Run `./scripts/workflow-testing.sh setup`
2. Test existing workflows: `./scripts/workflow-testing.sh test functional`
3. Gradually migrate workflow changes to use testing branch

### From Manual Testing to Automated Testing
1. Enable specific workflows for PR testing
2. Create comprehensive test suites
3. Set up monitoring and notifications

## Advanced Configurations

### Custom Testing Environments
Edit `.github/workflows/workflow-testing.yml` to add custom environments:

```yaml
matrix:
  env: [dev, staging, production]  # Add staging
```

### Conditional Testing
Use path filters to trigger specific tests:

```yaml
on:
  push:
    branches:
      - workflow-testing
    paths:
      - '.github/workflows/**'  # Only trigger on workflow changes
```

### Integration Testing
Test workflows with external services:

```yaml
steps:
  - name: Test external integrations
    run: |
      # Test Slack notifications
      # Test DataDog metrics
      # Test deployment targets
```