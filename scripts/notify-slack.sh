#!/bin/bash

# Slack notification script for XMTP test results
# This script sends a notification to Slack with test failure details

# Load environment variables from .env file if running locally
if [ -f .env ]; then
  echo "Loading environment variables from .env file"
  # Load Slack related variables
  export $(grep -v '^#' .env | grep '^SLACK_' | xargs)
else
  echo "No .env file found, assuming environment variables are set"
fi

# Check for required Slack credentials
if [ -z "$SLACK_BOT_TOKEN" ]; then
  echo "Error: SLACK_BOT_TOKEN environment variable is not set."
  echo "Please add your Bot User OAuth Token to your .env file or environment variables:"
  echo "SLACK_BOT_TOKEN=xoxb-your-token"
  exit 1
fi

SLACK_CHANNEL=${SLACK_CHANNEL:-"general"}
echo "Using Slack bot token with channel: $SLACK_CHANNEL"

# Get GitHub Actions context if available
WORKFLOW_NAME=${GITHUB_WORKFLOW:-"Unknown Workflow"}
REPOSITORY=${GITHUB_REPOSITORY:-"Unknown Repository"}
RUN_ID=${GITHUB_RUN_ID:-"Unknown Run ID"}
ACTOR=${GITHUB_ACTOR:-"Unknown Actor"}
GITHUB_REF=${GITHUB_REF:-"Unknown Branch"}
TEST_NAME=${TEST_NAME:-$(basename $(find suites -type d -name "TS_*" | head -1))}
XMTP_ENV=${XMTP_ENV:-"dev"}
JOB_STATUS=${JOB_STATUS:-"unknown"}

# Extract branch name from GITHUB_REF
BRANCH_NAME=$(echo $GITHUB_REF | sed -e "s/refs\/heads\///g")
echo "Current branch: $BRANCH_NAME"

# Only send notifications for main branch
# if [[ "$BRANCH_NAME" != "main" && "$BRANCH_NAME" != "master" ]]; then
#   echo "Not running on main/master branch. Skipping notification."
#   exit 0
# fi

# Check if the job status indicates an error/failure
# Only proceed with notification if it's an error
if [[ "$JOB_STATUS" == "success" || "$JOB_STATUS" == "passed" ]]; then
  echo "Job status is $JOB_STATUS. No need to send notification."
  exit 0
fi

# Create workflow run URL if both repository and run ID are available
WORKFLOW_URL=""
if [ "$REPOSITORY" != "Unknown Repository" ] && [ "$RUN_ID" != "Unknown Run ID" ]; then
  WORKFLOW_URL="• *Workflow URL:* https://github.com/${REPOSITORY}/actions/runs/${RUN_ID}"
fi

# Check if logs directory exists and look for error logs to add context
ERROR_LOGS=""
if [ -d "logs" ]; then
  # Get last 5 error lines from log files, if any
  LOG_EXCERPTS=$(grep -i "error\|fail\|exception" logs/*.log 2>/dev/null | tail -5)
  if [ ! -z "$LOG_EXCERPTS" ]; then
    ERROR_LOGS="\n\nError Logs:\n\`\`\`\n${LOG_EXCERPTS}\n\`\`\`"
  fi
fi

# Create a message with GitHub context
MESSAGE="*XMTP Test Report - FAILURE ❌*
• *Workflow:* https://github.com/xmtp/xmtp-qa-testing/actions/workflows/${WORKFLOW_NAME}.yml 
• *URL:* ${WORKFLOW_URL}
• *Test Suite:* ${TEST_NAME}
• *Network:* ${XMTP_ENV}
• *Status:* ${JOB_STATUS}
• *Branch:* ${BRANCH_NAME}
• *Timestamp:* $(date)
${ERROR_LOGS}"

echo "Sending error notification with workflow context"

# Send to Slack using the API
echo "Sending Slack notification..."
RESPONSE=$(curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"channel\":\"$SLACK_CHANNEL\",\"text\":\"$MESSAGE\",\"mrkdwn\":true}")

# Check the response
if echo "$RESPONSE" | grep -q "\"ok\":true"; then
  echo "✅ Slack notification sent successfully!"
else
  echo "❌ Failed to send Slack notification. Response:"
  echo "$RESPONSE"
  exit 1
fi 