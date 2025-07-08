# PR Verification with Wildcard Workflow

## Overview

The `Wildcard.yml` workflow is designed for manual verification of pull requests. It provides flexible testing options to validate your changes before merging.

## Quick Start

### Default Usage (Functional Tests)

```bash
# Trigger the workflow with default functional tests
gh workflow run Wildcard.yml
```

### Custom Test Type

```bash
# Run performance tests
gh workflow run Wildcard.yml -f test_type=performance

# Run functional tests (explicit)
gh workflow run Wildcard.yml -f test_type=functional
```

## When to Use

- **After creating a PR**: Verify your changes work correctly
- **Before merging**: Confirm changes don't break existing functionality
- **Performance validation**: Test performance impact of changes
- **Production verification**: Ensure changes work in production environment

## Test Types

### Functional Tests (Default)

Core protocol functionality including:

- Direct messaging
- Group conversations
- Consent management
- Installation handling
- Message delivery

### Performance Tests

Performance and scalability validation:

- Operation timing benchmarks
- Throughput measurements
- Resource usage analysis

## Configuration

The workflow automatically:

- Runs against production environment
- Uses debug logging for detailed output
- Uploads test artifacts for analysis
- Sends Slack notifications on failures
- Includes SDK version compatibility testing

## Manual Confirmation

**Important**: This workflow requires manual confirmation after PR creation. The workflow will not run automatically - you must trigger it manually when you're ready to verify your changes.

## Integration with PR Process

1. Create your PR
2. Run local verification: `yarn functional` or `yarn performance`
3. Manually trigger Wildcard workflow for production verification
4. Review results and artifacts
5. Merge if all tests pass

## Troubleshooting

- Check the Actions tab for detailed logs
- Review uploaded artifacts for test results
- Slack notifications will be sent on failures
- Use `--debug` flag for verbose logging in local tests
