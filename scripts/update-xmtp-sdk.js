#!/usr/bin/env node

/**
 * XMTP SDK Update Script
 * 
 * This script can be used to:
 * 1. Check for new versions of @xmtp/node-sdk
 * 2. Update dependencies following the project's versioning pattern
 * 3. Test the update logic locally before the workflow runs
 * 
 * Usage:
 *   node scripts/update-xmtp-sdk.js --check          # Check for updates only
 *   node scripts/update-xmtp-sdk.js --update         # Update to latest version
 *   node scripts/update-xmtp-sdk.js --version=3.1.0  # Update to specific version
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packageJsonPath = join(__dirname, '..', 'package.json');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function getCurrentVersion() {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return pkg.dependencies['@xmtp/node-sdk'];
}

function getLatestVersion() {
  try {
    const output = execSync('npm view @xmtp/node-sdk version', { encoding: 'utf8' });
    return output.trim();
  } catch (error) {
    throw new Error(`Failed to get latest version: ${error.message}`);
  }
}

function getNodeBindingsVersion(sdkVersion) {
  try {
    // Create a temporary directory to check dependencies
    const tempDir = join(__dirname, '..', 'temp_check');
    execSync(`mkdir -p ${tempDir}`);
    
    process.chdir(tempDir);
    execSync('npm init -y', { stdio: 'ignore' });
    execSync(`npm install @xmtp/node-sdk@${sdkVersion} --no-save`, { stdio: 'ignore' });
    
    const sdkPkg = JSON.parse(readFileSync('node_modules/@xmtp/node-sdk/package.json', 'utf8'));
    const bindingsVersion = sdkPkg.dependencies['@xmtp/node-bindings'];
    
    // Cleanup
    process.chdir(join(__dirname, '..'));
    execSync(`rm -rf ${tempDir}`);
    
    return bindingsVersion || null;
  } catch (error) {
    log(`Warning: Could not determine node-bindings version: ${error.message}`, colors.yellow);
    return null;
  }
}

function createVersionAlias(version) {
  // Remove dots and take first 3 digits (following the existing pattern)
  return version.replace(/\./g, '').substring(0, 3);
}

function updatePackageJson(newVersion, bindingsVersion) {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const versionAlias = createVersionAlias(newVersion);
  
  log(`Updating package.json...`, colors.blue);
  
  // Update main dependency
  pkg.dependencies['@xmtp/node-sdk'] = newVersion;
  log(`  ✓ Updated @xmtp/node-sdk to ${newVersion}`, colors.green);
  
  // Add versioned alias for node-sdk
  const sdkAliasKey = `@xmtp/node-sdk-${versionAlias}`;
  pkg.dependencies[sdkAliasKey] = `npm:@xmtp/node-sdk@${newVersion}`;
  log(`  ✓ Added alias ${sdkAliasKey}`, colors.green);
  
  // Add versioned alias for node-bindings if we found a version
  if (bindingsVersion) {
    const bindingsAlias = bindingsVersion.replace(/\./g, '').substring(0, 3);
    const bindingsAliasKey = `@xmtp/node-bindings-${bindingsAlias}`;
    
    if (!pkg.dependencies[bindingsAliasKey]) {
      pkg.dependencies[bindingsAliasKey] = `npm:@xmtp/node-bindings@${bindingsVersion}`;
      log(`  ✓ Added alias ${bindingsAliasKey}`, colors.green);
    } else {
      log(`  - Alias ${bindingsAliasKey} already exists`, colors.gray);
    }
    
    // Add package extension for the new SDK version
    if (!pkg.packageExtensions[`@xmtp/node-sdk@${newVersion}`]) {
      pkg.packageExtensions[`@xmtp/node-sdk@${newVersion}`] = {
        "dependencies": {
          "@xmtp/node-bindings": bindingsVersion
        }
      };
      log(`  ✓ Added package extension for @xmtp/node-sdk@${newVersion}`, colors.green);
    }
  } else {
    log(`  - No node-bindings version found for this SDK version`, colors.yellow);
  }
  
  // Sort dependencies and packageExtensions
  const sortObject = (obj) => {
    return Object.keys(obj).sort().reduce((result, key) => {
      result[key] = obj[key];
      return result;
    }, {});
  };
  
  pkg.dependencies = sortObject(pkg.dependencies);
  pkg.packageExtensions = sortObject(pkg.packageExtensions);
  
  writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  log(`  ✓ Sorted dependencies and saved package.json`, colors.green);
}

function installDependencies() {
  log(`Installing dependencies...`, colors.blue);
  try {
    execSync('yarn install', { stdio: 'inherit' });
    log(`  ✓ Dependencies installed successfully`, colors.green);
  } catch (error) {
    log(`  ✗ Failed to install dependencies: ${error.message}`, colors.red);
    throw error;
  }
}

function runTests() {
  log(`Running build test...`, colors.blue);
  try {
    execSync('yarn build', { stdio: 'pipe' });
    log(`  ✓ Build completed successfully`, colors.green);
    return true;
  } catch (error) {
    log(`  ✗ Build failed: ${error.message}`, colors.red);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const isCheckOnly = args.includes('--check');
  const isUpdate = args.includes('--update');
  const specificVersion = args.find(arg => arg.startsWith('--version='))?.split('=')[1];

  try {
    log(`🔍 XMTP SDK Update Tool\n`, colors.cyan);

    const currentVersion = getCurrentVersion();
    log(`Current version: ${currentVersion}`, colors.blue);

    if (specificVersion) {
      log(`Target version: ${specificVersion}`, colors.blue);
      
      if (currentVersion === specificVersion) {
        log(`Already on version ${specificVersion}`, colors.green);
        return;
      }
      
      log(`Checking node-bindings version for SDK ${specificVersion}...`, colors.blue);
      const bindingsVersion = getNodeBindingsVersion(specificVersion);
      if (bindingsVersion) {
        log(`Found node-bindings version: ${bindingsVersion}`, colors.green);
      }
      
      if (isUpdate) {
        updatePackageJson(specificVersion, bindingsVersion);
        installDependencies();
        
        if (runTests()) {
          log(`\n✅ Successfully updated to @xmtp/node-sdk@${specificVersion}`, colors.green);
        } else {
          log(`\n⚠️  Updated to @xmtp/node-sdk@${specificVersion} but build failed`, colors.yellow);
        }
      }
      return;
    }

    const latestVersion = getLatestVersion();
    log(`Latest version: ${latestVersion}`, colors.blue);

    if (currentVersion === latestVersion) {
      log(`\n✅ Already on the latest version (${currentVersion})`, colors.green);
      return;
    }

    log(`\n📦 New version available: ${currentVersion} → ${latestVersion}`, colors.yellow);

    if (isCheckOnly) {
      log(`Use --update flag to perform the update`, colors.gray);
      return;
    }

    if (!isUpdate) {
      log(`\nTo update, run: node scripts/update-xmtp-sdk.js --update`, colors.gray);
      return;
    }

    log(`\nChecking node-bindings version for SDK ${latestVersion}...`, colors.blue);
    const bindingsVersion = getNodeBindingsVersion(latestVersion);
    if (bindingsVersion) {
      log(`Found node-bindings version: ${bindingsVersion}`, colors.green);
    }

    updatePackageJson(latestVersion, bindingsVersion);
    installDependencies();
    
    if (runTests()) {
      log(`\n✅ Successfully updated to @xmtp/node-sdk@${latestVersion}`, colors.green);
      log(`\nNext steps:`, colors.cyan);
      log(`  1. Review the changes in package.json`, colors.gray);
      log(`  2. Test your application thoroughly`, colors.gray);
      log(`  3. Check the release notes: https://github.com/xmtp/xmtp-node-js-sdk/releases/tag/v${latestVersion}`, colors.gray);
      log(`  4. Commit the changes`, colors.gray);
    } else {
      log(`\n⚠️  Updated to @xmtp/node-sdk@${latestVersion} but build failed`, colors.yellow);
      log(`Please check the build errors and fix any compatibility issues.`, colors.gray);
    }

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Show help if no arguments or --help is passed
if (process.argv.length === 2 || process.argv.includes('--help') || process.argv.includes('-h')) {
  log(`XMTP SDK Update Tool`, colors.cyan);
  log(`\nUsage:`, colors.blue);
  log(`  node scripts/update-xmtp-sdk.js --check              # Check for updates only`);
  log(`  node scripts/update-xmtp-sdk.js --update             # Update to latest version`);
  log(`  node scripts/update-xmtp-sdk.js --version=3.1.0      # Update to specific version`);
  log(`  node scripts/update-xmtp-sdk.js --version=3.1.0 --update  # Update to specific version`);
  log(`\nOptions:`, colors.blue);
  log(`  --check         Check for updates without making changes`);
  log(`  --update        Perform the update (install dependencies and run tests)`);
  log(`  --version=X.Y.Z Update to a specific version`);
  log(`  --help, -h      Show this help message`);
  process.exit(0);
}

main();