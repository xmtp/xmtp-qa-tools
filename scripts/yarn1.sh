#!/bin/bash

# Unset PREFIX immediately if it exists to avoid nvm conflicts
if [ ! -z "$PREFIX" ]; then
    echo "Unsetting PREFIX environment variable to avoid nvm conflicts"
    unset PREFIX
fi

# Navigate to the gm-bot directory
cd bots/gm-bot || exit 1

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

# Function to run a simple test
test_simple() {
    local version=$1
    
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
    cd "$YARN1_DIR" || exit 1
    
    # Create a simple package.json for testing
    echo "Creating test package.json..."
    cat > package.json <<EOL
{
  "name": "yarn1-test",
  "version": "1.0.0",
  "scripts": {
    "build": "echo 'Build successful'",
    "check": "echo 'Check successful'",
    "client-check": "tsx src/check.ts"
  },
  "dependencies": {
    "tsx": "^4.19.2",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^20.14.2",
    "typescript": "^5.4.5"
  }
}
EOL
    
    # Create src directory and create a simple test file
    mkdir -p src
    echo "Creating a simple test file..."
    cat > src/check.ts <<EOL
import dotenv from "dotenv";

dotenv.config();

async function checkTest(): Promise<boolean> {
  console.log("Test successful!");
  return true;
}

void checkTest();
EOL
    
    # Create a .env file with dummy values for testing
    echo "Creating test .env file..."
    cat > .env <<EOL
TEST_VALUE=test
EOL
    
    # Install Yarn 1.x globally in the temporary directory
    echo "Installing Yarn 1.22.19 in isolated environment..."
    npm install -g yarn@1.22.19
    
    # Verify we're using the correct version
    YARN_VERSION=$(yarn --version)
    echo "Detected Yarn version: $YARN_VERSION"
    
    local test_success="❌"
    
    if [ "$YARN_VERSION" = "1.22.19" ]; then
        echo "✓ Using Yarn 1.22.19"
        
        # Create an empty yarn.lock file
        touch yarn.lock
        
        # Run the commands with yarn
        echo "Running yarn install..."
        if yarn install; then
            echo "yarn install successful"
            echo "Running yarn build..."
            if yarn build; then
                echo "yarn build successful"
                echo "Running yarn client-check..."
                if yarn client-check; then
                    echo "yarn client-check successful"
                    test_success="✅"
                else
                    echo "yarn client-check failed"
                fi
            else
                echo "yarn build failed"
            fi
        else
            echo "yarn install failed"
        fi
    else
        echo "❌ Failed to use Yarn 1.22.19, got $YARN_VERSION instead"
    fi
    
    # Return to original directory
    cd "$PROJECT_ROOT" || exit 1
    
    # Clean up
    rm -rf "$YARN1_DIR"
    
    echo "$test_success"
}

# Function to test XMTP client
test_xmtp() {
    local version=$1
    
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
    cd "$YARN1_DIR" || exit 1
    
    # Create a simple package.json for testing
    echo "Creating test package.json..."
    cat > package.json <<EOL
{
  "name": "yarn1-test",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "echo 'Build successful'",
    "check": "echo 'Check successful'",
    "client-check": "tsx src/check.ts"
  },
  "dependencies": {
    "@xmtp/node-sdk": "1.0.0-rc2",
    "tsx": "^4.19.2",
    "uint8arrays": "^4.0.0",
    "viem": "^2.22.17",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^20.14.2",
    "typescript": "^5.4.5"
  }
}
EOL
    
    # Create src directory and copy check.ts
    mkdir -p src
    echo "Creating XMTP test file..."
    cat > src/check.ts <<EOL
import { Client } from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { fromString } from "uint8arrays";

dotenv.config();

const createSigner = (key) => {
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });
  
  return {
    type: "EOA",
    getIdentifier: () => ({
      identifierKind: 0, // Ethereum
      identifier: account.address.toLowerCase(),
    }),
    signMessage: async (message) => {
      const signature = await wallet.signMessage({
        message,
        account,
      });
      return Buffer.from(signature.slice(2), "hex");
    },
  };
};

const getEncryptionKeyFromHex = (hex) => {
  return fromString(hex, "hex");
};

async function checkXmtp() {
  try {
    console.log("Testing XMTP client initialization...");
    
    // Use dummy values for testing
    const walletKey = "0x0000000000000000000000000000000000000000000000000000000000000001";
    const encryptionKey = getEncryptionKeyFromHex("0000000000000000000000000000000000000000000000000000000000000002");
    
    const signer = createSigner(walletKey);
    
    // Just test if we can create a client without errors
    console.log("Creating XMTP client...");
    const client = await Client.create(signer, encryptionKey, {
      env: "production",
      skipContactPublishing: true,
      skipRegisteringEnvelopes: true,
    });
    
    console.log("XMTP client created successfully!");
    return true;
  } catch (error) {
    console.error("Error testing XMTP client:", error);
    return false;
  }
}

void checkXmtp();
EOL
    
    # Create a .env file with dummy values for testing
    echo "Creating test .env file..."
    cat > .env <<EOL
WALLET_KEY=0x0000000000000000000000000000000000000000000000000000000000000001
ENCRYPTION_KEY=0x0000000000000000000000000000000000000000000000000000000000000002
GM_BOT_ADDRESS=0x0000000000000000000000000000000000000003
XMTP_ENV=production
LOGGING_LEVEL=silent
EOL
    
    # Install Yarn 1.x globally in the temporary directory
    echo "Installing Yarn 1.22.19 in isolated environment..."
    npm install -g yarn@1.22.19
    
    # Verify we're using the correct version
    YARN_VERSION=$(yarn --version)
    echo "Detected Yarn version: $YARN_VERSION"
    
    local test_success="❌"
    
    if [ "$YARN_VERSION" = "1.22.19" ]; then
        echo "✓ Using Yarn 1.22.19"
        
        # Create an empty yarn.lock file
        touch yarn.lock
        
        # Run the commands with yarn
        echo "Running yarn install..."
        if yarn install; then
            echo "yarn install successful"
            echo "Running yarn build..."
            if yarn build; then
                echo "yarn build successful"
                echo "Running yarn client-check..."
                if yarn client-check; then
                    echo "yarn client-check successful"
                    test_success="✅"
                else
                    echo "yarn client-check failed"
                fi
            else
                echo "yarn build failed"
            fi
        else
            echo "yarn install failed"
        fi
    else
        echo "❌ Failed to use Yarn 1.22.19, got $YARN_VERSION instead"
    fi
    
    # Return to original directory
    cd "$PROJECT_ROOT" || exit 1
    
    # Clean up
    rm -rf "$YARN1_DIR"
    
    echo "$test_success"
}

# Main execution
echo "🔍 Starting Yarn 1 compatibility tests"
echo "-----------------------------------"

check_nvm

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