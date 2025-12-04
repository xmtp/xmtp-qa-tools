# XMTP Load Test

High-performance load testing for XMTP (5M+ msgs/day).

## Usage

```bash
cd load-test
yarn install

# Setup: Create identities and groups
yarn setup -- -i 100 -g 10 -m 20 -e dev

# Run: Artillery load test
yarn test

# Or: Simple TypeScript runner
yarn test:simple

# Clean: Remove test data
yarn clean
```

## Config

Edit `artillery-config.yml` to adjust load profile (rate, duration, workers).

