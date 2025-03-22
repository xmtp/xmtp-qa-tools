#!/bin/bash

# Unset PREFIX immediately if it exists to avoid nvm conflicts
if [ ! -z "$PREFIX" ]; then
    echo "Unsetting PREFIX environment variable to avoid nvm conflicts"
    unset PREFIX
fi

# Navigate to the gm-bot directory
cd bots/gm-bot || exit 1

touch yarn.lock
# Add this at the beginning of the script
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

# At the beginning of the script
ROOT_PACKAGE_JSON="../package.json"
ROOT_PACKAGE_JSON_BACKUP="../package.json.backup"

# Backup and modify root package.json if it exists and has packageManager field
if [ -f "$ROOT_PACKAGE_JSON" ]; then
    if grep -q "\"packageManager\"" "$ROOT_PACKAGE_JSON"; then
        echo "📦 Temporarily backing up root package.json to avoid packageManager conflicts"
        cp "$ROOT_PACKAGE_JSON" "$ROOT_PACKAGE_JSON_BACKUP"
        # Remove packageManager field for testing
        sed -i.bak '/packageManager/d' "$ROOT_PACKAGE_JSON"
        rm -f "$ROOT_PACKAGE_JSON.bak"
    fi
fi

# Function to test a package manager with different Node versions
test_package_manager() {
    local pm=$1
    local node_versions=("18" "20" "21" "22" "23")
    local results=()
    
    for version in "${node_versions[@]}"; do
        nvm use $version || {
            echo "Installing Node $version..."
            nvm install $version || {
                echo "❌ Failed to install Node $version"
                results+=("❌")
                continue
            }
            nvm use $version
        }
        
        echo "🧪 Testing with $pm on Node $version..."
        
        # Clean up
        echo "🧹 Cleaning up previous installations..."
        rm -rf node_modules
        rm -rf dist
        rm -rf .yarn
        rm -f package-lock.json
        rm -f bun.lockb
        rm -f pnpm-lock.yaml
        rm -f yarn.lock
        
        # Disable corepack before each package manager test
        corepack disable
        
        local test_success=true
        
        case $pm in
            "pnpm")
                pnpm install && pnpm run build && pnpm run client-check || test_success=false
                ;;
            "npm")
                npm install && npm run build && npm run client-check || test_success=false
                ;;
            "bun")
                bun install && bun run build && bun client-check || test_success=false
                ;; 
            "yarn")
                touch yarn.lock
                yarn install && yarn build && yarn client-check || test_success=false
                ;;
        esac
        
        if [ "$test_success" = true ]; then
            echo "✅ $pm test completed successfully on Node $version"
            results+=("✅")
        else
            echo "❌ $pm test failed on Node $version"
            results+=("❌")
        fi
        echo "-----------------------------------"
    done
    
    # Store results in global array
    eval "results_${pm}=(${results[@]})"
}

# Check if package managers are installed
check_package_managers() {
    local missing_managers=()
    
    if ! command -v npm &> /dev/null; then
        missing_managers+=("npm")
    fi
    if ! command -v yarn &> /dev/null; then
        missing_managers+=("yarn")
    fi
    if ! command -v pnpm &> /dev/null; then
        missing_managers+=("pnpm")
    fi
    if ! command -v bun &> /dev/null; then
        missing_managers+=("bun")
    fi
    
    if [ ${#missing_managers[@]} -ne 0 ]; then
        echo "❌ Missing package managers: ${missing_managers[*]}"
        echo "Please install them before running this script:"
        echo "npm: npm install -g npm"
        echo "yarn: npm install -g yarn"
        echo "pnpm: npm install -g pnpm"
        echo "bun: curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi
}

# Main execution
package_managers=("pnpm" "npm" "yarn" "bun")

echo "🔍 Starting package manager compatibility tests"
echo "-----------------------------------"

check_nvm
check_package_managers

# Test all package managers
for pm in "${package_managers[@]}"; do
    test_package_manager "$pm"
done

# Print results matrix
echo "📊 Test Results Matrix"
echo "-----------------------------------"
echo "Package Manager  18 | 20 | 21 | 22 | 23"
echo "---------------|----------|----------|----------|----------"
for pm in "${package_managers[@]}"; do
    results_var="results_${pm}[@]"
    printf "%-14s |" "$pm"
    eval 'for result in "${'"$results_var"'}"; do printf " %-8s |" "$result"; done'
    echo
done
echo "-----------------------------------"
echo "🎉 Testing completed!"

# Re-enable corepack at the end
corepack enable

# At the end of the script
# Restore original package.json if we backed it up
if [ -f "$ROOT_PACKAGE_JSON_BACKUP" ]; then
    echo "📦 Restoring original root package.json"
    mv "$ROOT_PACKAGE_JSON_BACKUP" "$ROOT_PACKAGE_JSON"
fi 
