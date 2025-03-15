#!/bin/bash

# Unset PREFIX immediately if it exists to avoid nvm conflicts
if [ ! -z "$PREFIX" ]; then
    echo "Unsetting PREFIX environment variable to avoid nvm conflicts"
    unset PREFIX
fi

# Script can be run from any directory in the monorepo
# We'll assume the structure has bots/gm-bot inside the root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# If script is in scripts directory, adjust ROOT_DIR
if [[ "$SCRIPT_DIR" == *"/scripts" ]]; then
    ROOT_DIR="$(dirname "$SCRIPT_DIR")"
fi
GM_BOT_DIR="$ROOT_DIR/bots/gm-bot"

# Navigate to the gm-bot directory
echo "📁 Changing to gm-bot directory at $GM_BOT_DIR"
cd "$GM_BOT_DIR" || {
    echo "❌ Failed to navigate to $GM_BOT_DIR"
    echo "Make sure this script is placed in the scripts directory of your monorepo"
    exit 1
}

# Disable corepack at the beginning
corepack disable

# Source nvm first
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"  # This loads nvm

# Check if nvm is available after sourcing
check_nvm() {
    if [ -z "$(command -v nvm)" ]; then
        echo "❌ nvm not found. Please install nvm first."
        exit 1
    fi
}

# Backup and modify root package.json if it exists and has packageManager field
ROOT_PACKAGE_JSON="package.json"
ROOT_PACKAGE_JSON_BACKUP="package.json.backup"

if [ -f "$ROOT_PACKAGE_JSON" ]; then
    if grep -q "\"packageManager\"" "$ROOT_PACKAGE_JSON"; then
        echo "📦 Temporarily backing up root package.json to avoid packageManager conflicts"
        cp "$ROOT_PACKAGE_JSON" "$ROOT_PACKAGE_JSON_BACKUP"
        # Remove packageManager field for testing
        sed -i.bak '/packageManager/d' "$ROOT_PACKAGE_JSON"
        rm -f "$ROOT_PACKAGE_JSON.bak"
    fi
fi

# Function to test yarn1 with different Node versions
test_yarn1() {
    local node_versions=("20" "21" "22" "23")
    local results=()
    
    for version in "${node_versions[@]}"; do
        echo "🔄 Setting up Node $version..."
        nvm use $version || {
            echo "Installing Node $version..."
            nvm install $version || {
                echo "❌ Failed to install Node $version"
                results+=("❌")
                continue
            }
            nvm use $version
        }
        
        echo "🧪 Testing with Yarn 1 on Node $version..."
        
        # Clean up
        echo "🧹 Cleaning up previous installations..."
        rm -rf node_modules || sudo rm -rf node_modules
        rm -rf dist
        rm -rf .data/
        rm -rf .yarn
        rm -f package-lock.json
        rm -f bun.lockb
        rm -f pnpm-lock.yaml
        rm -f .yarnrc
        rm -f yarn.lock
        
        # Disable corepack 
        corepack disable
        
        # Create a temporary directory for yarn1
        YARN1_DIR=$(mktemp -d)
        echo "Created temporary directory: $YARN1_DIR"
        
        # Create a completely isolated environment
        cd "$YARN1_DIR"
        
        # Copy the actual gm-bot package.json for testing
        echo "Copying gm-bot package.json for testing..."
        cp "$GM_BOT_DIR/package.json" ./package.json
        
        # Temporarily remove any packageManager field if it exists
        sed -i.bak '/packageManager/d' package.json
        rm -f package.json.bak
        
        # Install Yarn 1.x globally in the temporary directory
        echo "Installing Yarn 1.22.19 in isolated environment..."
        npm install -g yarn@1.22.19
        
        # Copy necessary files from the original gm-bot directory
        echo "Copying necessary files from gm-bot directory..."
        mkdir -p src
        cp -r "$GM_BOT_DIR/src" .
        
        # Copy tsconfig.json if it exists
        if [ -f "$GM_BOT_DIR/tsconfig.json" ]; then
            cp "$GM_BOT_DIR/tsconfig.json" .
        fi
        
        # Verify we're using the correct version
        YARN_VERSION=$(yarn --version)
        echo "Detected Yarn version: $YARN_VERSION"
        
        local test_success=false
        
        if [ "$YARN_VERSION" = "1.22.19" ]; then
            echo "✓ Using Yarn 1.22.19"
            
            # Create an empty yarn.lock file
            touch yarn.lock
            
            # Run the commands with yarn
            if yarn install && yarn build && yarn check; then
                test_success=true
            else
                test_success=false
            fi
        else
            echo "❌ Failed to use Yarn 1.22.19, got $YARN_VERSION instead"
            test_success=false
        fi
        
        # Return to original directory
        cd - > /dev/null
        
        # Clean up
        rm -rf "$YARN1_DIR"
        
        if [ "$test_success" = true ]; then
            echo "✅ Yarn 1 test completed successfully on Node $version"
            results+=("✅")
        else
            echo "❌ Yarn 1 test failed on Node $version"
            results+=("❌")
        fi
        echo "-----------------------------------"
    done
    
    # Print results for yarn1
    echo "📊 Yarn 1 Test Results"
    echo "-----------------------------------"
    echo "Node Version | Result"
    echo "-------------|--------"
    for i in "${!node_versions[@]}"; do
        printf "%-12s | %s\n" "Node ${node_versions[$i]}" "${results[$i]}"
    done
}

# Main execution
echo "🔍 Starting Yarn 1 compatibility tests"
echo "-----------------------------------"

check_nvm

# Print monorepo structure information
echo "Monorepo Information:"
echo "- Root directory: $ROOT_DIR"
echo "- GM Bot directory: $GM_BOT_DIR"
echo "-----------------------------------"

# Test yarn1
test_yarn1

echo "-----------------------------------"
echo "🎉 Testing completed!"

# Re-enable corepack at the end
corepack enable

# Restore original package.json if we backed it up
if [ -f "$ROOT_PACKAGE_JSON_BACKUP" ]; then
    echo "📦 Restoring original root package.json"
    mv "$ROOT_PACKAGE_JSON_BACKUP" "$ROOT_PACKAGE_JSON"
fi