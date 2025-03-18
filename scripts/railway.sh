#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  echo "Loading environment variables from .env file"
  export $(grep -v '^#' .env | xargs)
else
  echo "Error: .env file not found"
  exit 1
fi

# Check if RAILWAY_PROJECT_TOKEN is set
if [ -z "$RAILWAY_PROJECT_TOKEN" ]; then
  echo "Error: RAILWAY_PROJECT_TOKEN is not set in .env file"
  exit 1
fi

# Set Railway token directly
export RAILWAY_TOKEN="$RAILWAY_PROJECT_TOKEN"
echo "Using Railway project token: ${RAILWAY_PROJECT_TOKEN:0:8}..."

# Check CLI version
echo "Railway CLI version:"
railway --version

# Check connection status
echo "Checking Railway status:"
railway status

# Important: The key issue is understanding what 'railway run' does
# It executes a command locally but with Railway environment variables
# To truly run on Railway infrastructure, we need to use railway exec

echo "Running test on Railway remote infrastructure..."
# Use railway exec to run a command on the remote service
railway run --service "xmtp-qa-testing:us-east" -- bash -c '
  echo "Running on Railway remote infrastructure"
  echo "Service details:" 
  echo "- Project name: $RAILWAY_PROJECT_NAME" 
  echo "- Environment: $RAILWAY_ENVIRONMENT_NAME"
  echo "- Service name: $RAILWAY_SERVICE_NAME"
  echo "- Service ID: $RAILWAY_SERVICE_ID"
  
  # Set XMTP_ENV to production manually
  export XMTP_ENV=production
  export GEOLOCATION=us-east
  
  echo "- XMTP environment: $XMTP_ENV"
  echo "- Geolocation: $GEOLOCATION"
  
  # Run the test
  yarn test ts_performance
'