#!/bin/bash

# Set your Railway token
export RAILWAY_TOKEN="73286d48-1ca0-469e-b9b1-fca1f5011ae8"

# Check CLI version
echo "Railway CLI version:"
railway --version

# Check connection status
echo "Checking Railway status:"
railway status


# Run your performance test
echo "Running performance test on service:"
railway run -s xmtp-qa-testing:us-west yarn test ts_performance