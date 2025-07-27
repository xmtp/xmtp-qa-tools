# Slack Notification Action

A reusable GitHub Action that sends Slack notifications for workflow status updates.

## Features

- ✅ Sends notifications for failed, cancelled, and optionally successful workflows
- 🎯 Customizable workflow names with matrix information
- 📍 Includes environment and region information
- 🔗 Direct links to workflow runs
- 👤 User mentions for failures/cancellations (not for successes)

## Usage

### Basic Usage (Failure/Cancellation only)

```yaml
- name: Send Slack notification on failure
  if: failure() || cancelled()
  uses: ./.github/actions/slack-notification
  with:
    workflow-name: 'My Workflow'
    slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
```

### Advanced Usage with Matrix

```yaml
- name: Send Slack notification on failure
  if: failure() || cancelled()
  uses: ./.github/actions/slack-notification
  with:
    workflow-name: 'My Workflow (${{ matrix.env }}, ${{ matrix.test }})'
    slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
    slack-channel: 'my-custom-channel'
    mention-user: 'myusername'
```

### Success Notifications

```yaml
- name: Send Slack notification
  if: always()
  uses: ./.github/actions/slack-notification
  with:
    workflow-name: 'Important Deployment'
    slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
    notify-on-success: 'true'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `workflow-name` | Name of the workflow | ✅ Yes | - |
| `slack-bot-token` | Slack bot token | ✅ Yes | - |
| `status` | Workflow status (success, failure, cancelled) | ❌ No | `${{ job.status }}` |
| `slack-channel` | Slack channel to send notification to | ❌ No | `notify-qa-tools-test` |
| `mention-user` | User to mention in failure/cancellation notifications | ❌ No | `fabri` |
| `notify-on-success` | Whether to send notifications for successful workflows | ❌ No | `false` |

## Environment Variables

The action reads the following environment variables for context:

- `XMTP_ENV` - Current XMTP environment (dev, production, local, etc.)
- `REGION` - Deployment region

## Required Secrets

Make sure your repository has the following secrets configured:

- `SLACK_BOT_TOKEN` - Your Slack bot token with `chat:write` permissions

## Message Format

### Failure/Cancellation
```
*Workflow*: My Workflow FAIL ❌ @fabri
*Timestamp*: `2024-01-15T10:30:00Z`
*env*: `production` | *region*: `us-east-1`
View run
```

### Success (when enabled)
```
*Workflow*: My Workflow SUCCESS ✅
*Timestamp*: `2024-01-15T10:30:00Z`
*env*: `production` | *region*: `us-east-1`
View run
```

## Migration from `yarn workflow-failure`

If you're migrating from the old `yarn workflow-failure` approach:

### Before
```yaml
- name: Send Slack notification on failure
  if: failure() || cancelled()
  run: yarn workflow-failure "My Workflow"
```

### After
```yaml
- name: Send Slack notification on failure
  if: failure() || cancelled()
  uses: ./.github/actions/slack-notification
  with:
    workflow-name: 'My Workflow'
    slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
```

## Benefits of the Action Approach

1. **Consistency**: All workflows use the same notification format
2. **Maintainability**: Updates to notification logic only require changes in one place
3. **Flexibility**: Easy to customize per workflow with inputs
4. **No Dependencies**: No need to install Node.js or dependencies just for notifications
5. **Better Error Handling**: Cleaner separation of concerns