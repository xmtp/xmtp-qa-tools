#!/bin/bash

# Test script for Slack notifications
# This script directly sends a test notification to Slack

# Load environment variables from .env file
if [ -f .env ]; then
  echo "Loading environment variables from .env file"
  # Load only the SLACK_TOKEN variable
  export $(grep -v '^#' .env | grep '^SLACK_' | xargs)
else
  echo "Error: .env file not found"
  exit 1
fi

# Check if SLACK_TOKEN is set
if [ -z "$SLACK_TOKEN" ]; then
  echo "Error: SLACK_TOKEN environment variable is not set."
  echo "Please set it using: export SLACK_TOKEN=\"your-token-here\""
  exit 1
fi

SLACK_CHANNEL=${SLACK_CHANNEL:-"general"}
echo "SLACK_TOKEN is set. Using channel: $SLACK_CHANNEL"

# Get hostname and current directory for context
HOSTNAME=$(hostname)
CURRENT_DIR=$(pwd)

# Create a test message
MESSAGE="Test notification from $HOSTNAME in directory $CURRENT_DIR at $(date)"
echo "Sending message: $MESSAGE"

# Send to Slack using the API
echo "Sending Slack notification..."
RESPONSE=$(curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"channel\":\"$SLACK_CHANNEL\",\"text\":\"$MESSAGE\"}")

# Check the response
if echo "$RESPONSE" | grep -q "\"ok\":true"; then
  echo "✅ Slack notification sent successfully!"
else
  echo "❌ Failed to send Slack notification. Response:"
  echo "$RESPONSE"
  exit 1
fi 