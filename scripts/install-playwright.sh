#!/bin/bash

# Playwright installation script with caching
set -e

echo "Checking Playwright installation..."

# Check if Playwright is already installed and working
if npx playwright --version > /dev/null 2>&1; then
    echo "Playwright is already installed and working"
    exit 0
fi

# Check if browser binaries are already downloaded
if [ -d ".playwright-cache" ] && [ -d ".playwright-cache/browsers" ]; then
    echo "Playwright browsers found in cache, installing without download..."
    npx playwright install --with-deps chromium
else
    echo "Installing Playwright with browser download..."
    npx playwright install --with-deps chromium
fi

echo "Playwright installation completed"