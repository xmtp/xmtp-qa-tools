#!/bin/bash
# Quick start script for XMTP load testing

echo "🚀 XMTP Load Test - Quick Start"
echo "================================"
echo ""

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js and npm."
    exit 1
fi

# Install dependencies
echo "📦 Step 1: Installing dependencies..."
npm install
echo ""

# Check for existing config
if [ -f "./data/load-test-config.json" ]; then
    echo "⚠️  Found existing configuration in ./data/"
    read -p "Do you want to use it? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Creating new configuration..."
        RUN_SETUP=true
    else
        RUN_SETUP=false
    fi
else
    RUN_SETUP=true
fi

# Run setup if needed
if [ "$RUN_SETUP" = true ]; then
    echo "📝 Step 2: Setting up test environment..."
    echo ""
    echo "How many identities? (recommended: 50-200): "
    read IDENTITIES
    echo "How many groups? (recommended: 5-20): "
    read GROUPS
    echo "Members per group? (recommended: 10-50): "
    read MEMBERS
    echo "Environment (dev/production)? [dev]: "
    read ENV
    ENV=${ENV:-dev}
    
    npm run setup -- -i "$IDENTITIES" -g "$GROUPS" -m "$MEMBERS" -e "$ENV"
    echo ""
fi

# Ask which test to run
echo "🔥 Step 3: Choose test type"
echo "1) Full Artillery load test (production)"
echo "2) Simple test runner (quick test)"
echo "3) Artillery with debug output"
echo ""
read -p "Select (1-3): " -n 1 -r TEST_TYPE
echo ""
echo ""

case $TEST_TYPE in
    1)
        echo "🚀 Running full Artillery load test..."
        echo "⚠️  This will run for the duration specified in artillery-config.yml"
        echo "   Press Ctrl+C to stop"
        echo ""
        npm run test
        ;;
    2)
        echo "🚀 Running simple test (60 seconds)..."
        npm run test:simple
        ;;
    3)
        echo "🚀 Running Artillery with debug output..."
        npm run test:debug
        echo ""
        echo "📊 Generating report..."
        npm run report
        echo ""
        echo "📈 Analyzing results..."
        npm run analyze
        ;;
    *)
        echo "❌ Invalid selection"
        exit 1
        ;;
esac

echo ""
echo "✅ Done!"

