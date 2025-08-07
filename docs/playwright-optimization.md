# Playwright Installation Optimization

This document explains the optimizations implemented to reduce Playwright installation time.

## Problem

Playwright installation was taking significant time because:
- It downloads Chromium browser binaries (~172MB) on every install
- No caching was configured for browser binaries
- Installation happened on every `yarn install`

## Solutions Implemented

### 1. Playwright Cache Configuration

Added to `.yarnrc.yml`:
```yaml
playwrightCacheDir: .playwright-cache
```

This tells Playwright to store browser binaries in a local cache directory.

### 2. Installation Script

Created `scripts/install-playwright.sh` that:
- Checks if Playwright is already installed
- Checks if browser binaries are cached
- Only downloads browsers if not already present
- Provides clear feedback on installation status

### 3. GitHub Actions Caching

Updated `.github/actions/xmtp-test-setup/action.yml` to cache:
- `.playwright-cache` directory
- Browser binaries across CI runs

### 4. Package.json Optimizations

- Added `playwright:install` script for manual installation
- Updated `record` script to use optimized installation
- Added `postinstall` script for automatic installation

## Usage

### Manual Installation
```bash
yarn playwright:install
```

### Using Playwright
```bash
# This will automatically install Playwright if needed
yarn record
```

### CI/CD
The GitHub Actions workflows automatically cache Playwright browsers, so subsequent runs will be much faster.

## Expected Time Savings

- **First run**: Still downloads browsers (~2-3 minutes)
- **Subsequent runs**: Uses cached browsers (~30 seconds)
- **CI/CD**: Cached across workflow runs

## Cache Locations

- **Local**: `.playwright-cache/`
- **CI**: GitHub Actions cache with key `playwright-{hash}`

## Troubleshooting

If you encounter issues:

1. Clear the cache: `rm -rf .playwright-cache`
2. Reinstall: `yarn playwright:install`
3. Check Playwright version: `npx playwright --version`

## Files Modified

- `.yarnrc.yml` - Added cache configuration
- `.gitignore` - Added cache directory
- `package.json` - Added scripts and postinstall
- `scripts/install-playwright.sh` - Installation script
- `.github/actions/xmtp-test-setup/action.yml` - CI caching
- `docs/playwright-optimization.md` - This documentation