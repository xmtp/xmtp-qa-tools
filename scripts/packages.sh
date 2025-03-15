#!/bin/bash

# Add this at the beginning of the script
corepack disable

# Source nvm first
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"  # This loads nvm

# Check if nvm is available after sourcing
check_nvm() {
    if [ -z "$(command -v nvm)" ]; then
        exit 1
    fi
    
    # Unset PREFIX if it exists to avoid nvm conflicts
    if [ ! -z "$PREFIX" ]; then
        unset PREFIX
    fi
}

# Navigate to the gm-bot directory
cd bots/gm-bot || exit 1

# Function to test a package manager with different Node versions
test_package_manager() {
    local pm=$1
    local node_versions=("20" "21" "22" "23")
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
        
        local test_success=true
        
        case $pm in
            "pnpm")
                pnpm install --ignore-workspace && pnpm run build && pnpm test || test_success=false
                ;;
            "npm")
                npm install && npm run build && npm test || test_success=false
                ;;
            "bun")
                bun install && bun run build && bun test || test_success=false
                ;;
            "yarn")
                touch yarn.lock
                yarn install && yarn build && yarn test || test_success=false
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
declare -A all_results
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
echo "Package Manager | Node 20 | Node 21 | Node 22 | Node 23"
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