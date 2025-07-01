#!/bin/bash

# IPA Testing Setup Script
echo "🚀 Setting up IPA testing environment..."

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ Error: IPA testing requires macOS"
    exit 1
fi

# Check if Xcode is installed
if ! command -v xcrun &> /dev/null; then
    echo "❌ Error: Xcode is not installed. Please install Xcode from the App Store."
    exit 1
fi

echo "✅ Xcode found"

# Check if Maestro is installed
if ! command -v maestro &> /dev/null; then
    echo "📦 Installing Maestro CLI..."
    curl -Ls "https://get.maestro.mobile.dev" | bash
    export PATH="$PATH":"$HOME/.maestro/bin"
    
    # Verify installation
    if ! command -v maestro &> /dev/null; then
        echo "❌ Error: Maestro installation failed"
        exit 1
    fi
else
    echo "✅ Maestro found"
fi

# Check Maestro version
echo "📋 Maestro version: $(maestro --version)"

# Create directories
echo "📁 Creating directories..."
mkdir -p suites/mobile/ipa/apps
mkdir -p logs/screenshots
mkdir -p logs/videos

# Check if IPA_PATH is set
if [[ -z "$IPA_PATH" ]]; then
    echo "⚠️  Warning: IPA_PATH environment variable is not set"
    echo "   Please set it to the path of your IPA file:"
    echo "   export IPA_PATH=/path/to/your/app.ipa"
else
    echo "✅ IPA_PATH: $IPA_PATH"
    
    # Check if IPA file exists
    if [[ ! -f "$IPA_PATH" ]]; then
        echo "❌ Error: IPA file not found at $IPA_PATH"
        exit 1
    fi
    
    # Copy IPA to apps directory if it's not already there
    IPA_FILENAME=$(basename "$IPA_PATH")
    if [[ ! -f "suites/mobile/ipa/apps/$IPA_FILENAME" ]]; then
        echo "📦 Copying IPA to apps directory..."
        cp "$IPA_PATH" "suites/mobile/ipa/apps/"
    fi
fi

# Check if APP_BUNDLE_ID is set
if [[ -z "$APP_BUNDLE_ID" ]]; then
    echo "⚠️  Warning: APP_BUNDLE_ID environment variable is not set"
    echo "   Please set it to your app's bundle identifier:"
    echo "   export APP_BUNDLE_ID=com.yourcompany.yourapp"
else
    echo "✅ APP_BUNDLE_ID: $APP_BUNDLE_ID"
fi

# List available simulators
echo "📱 Available iOS Simulators:"
xcrun simctl list devices --json | grep -A 5 -B 5 "iPhone"

# Check if iOS Simulator is running
SIMULATOR_RUNNING=$(xcrun simctl list devices | grep "Booted" | wc -l)
if [[ $SIMULATOR_RUNNING -gt 0 ]]; then
    echo "✅ iOS Simulator is running"
else
    echo "💤 iOS Simulator is not running"
    echo "   Starting iPhone 15 Pro simulator..."
    
    # Try to find and boot iPhone 15 Pro
    DEVICE_UDID=$(xcrun simctl list devices --json | grep -A 10 "iPhone 15 Pro" | grep "udid" | head -1 | sed 's/.*"udid" : "\(.*\)".*/\1/')
    
    if [[ -n "$DEVICE_UDID" ]]; then
        xcrun simctl boot "$DEVICE_UDID"
        echo "✅ Started iPhone 15 Pro simulator"
    else
        echo "⚠️  No iPhone 15 Pro simulator found. Creating one..."
        xcrun simctl create "iPhone 15 Pro Test" com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro com.apple.CoreSimulator.SimRuntime.iOS-17-0
    fi
fi

# Check environment variables
echo ""
echo "📋 Environment Check:"
echo "   XMTP_ENV: ${XMTP_ENV:-not set}"
echo "   IPA_PATH: ${IPA_PATH:-not set}"
echo "   APP_BUNDLE_ID: ${APP_BUNDLE_ID:-not set}"
echo "   MAESTRO_DEBUG: ${MAESTRO_DEBUG:-false}"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📖 Next steps:"
echo "   1. Set your environment variables in .env file"
echo "   2. Place your IPA file in suites/mobile/ipa/apps/"
echo "   3. Run tests with: yarn test ipa"
echo ""
echo "📚 For more information, see: suites/mobile/ipa/README.md"