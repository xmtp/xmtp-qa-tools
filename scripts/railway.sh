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

# Link to the project, environment, and specific service
echo "Linking to project and service..."
railway link --project "$RAILWAY_PROJECT_ID" --environment "$RAILWAY_ENVIRONMENT_ID" --service "xmtp-qa-testing:us-east"

# Check connection status
echo "Checking Railway status:"
railway status

# Run your performance test
echo "Running performance test..."

# Run with proper environment variables
railway run --env XMTP_ENV=production -- \
  bash -c 'echo "Service details:"; 
  echo "- Project name: $RAILWAY_PROJECT_NAME"; 
  echo "- Environment: $RAILWAY_ENVIRONMENT_NAME";
  echo "- Service name: $RAILWAY_SERVICE_NAME";
  
  # Extract geolocation from service name
  export GEOLOCATION=$(echo $RAILWAY_SERVICE_NAME | cut -d":" -f2);
  echo "- Extracted geolocation: $GEOLOCATION";
  echo "- XMTP environment: $XMTP_ENV";
  
  # Run the test
  yarn test ts_performance'