#!/bin/bash

# Script to rerun tests that were missing configuration
# with proper environment variables and configs

export XMTP_D14N=true
export XMTP_API_URL=https://grpc.testnet-staging.xmtp.network:443
export XMTP_ENV=dev

# Load env vars from .env file
source /home/ubuntu/xmtp-qa-tools/.env

# For concurrency test - use one of the available wallet keys
export WALLET_KEY=$XMTP_WALLET_KEY_WINSTON
export ENCRYPTION_KEY=$XMTP_DB_ENCRYPTION_KEY_WINSTON

RESULTS_DIR="/tmp/test_results_fixed"
mkdir -p "$RESULTS_DIR"

cd /home/ubuntu/xmtp-qa-tools

echo "=========================================="
echo "Rerunning tests with proper configuration"
echo "D14N: $XMTP_D14N"
echo "API URL: $XMTP_API_URL"
echo "=========================================="
echo ""

# Test 1: Concurrency (needs WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV)
echo "--- Running concurrency test (5 iterations) ---"
for iter in {1..5}; do
    echo "Iteration $iter/5..."
    npx vitest run measurements/concurrency.test.ts \
        --pool=threads \
        --poolOptions.singleThread=true \
        --fileParallelism=false \
        > "$RESULTS_DIR/concurrency_iter${iter}.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✓ concurrency iteration $iter: PASS"
        CONCURRENCY_RESULTS[$iter]="PASS"
    else
        echo "✗ concurrency iteration $iter: FAIL"
        CONCURRENCY_RESULTS[$iter]="FAIL"
    fi
    sleep 2
done

# Test 2: Forks (needs FORK_TEST_CONFIG)
echo ""
echo "--- Running forks test (5 iterations) ---"

# Create minimal fork test config
FORK_CONFIG='{
  "groupCount": 2,
  "parallelOperations": 2,
  "targetEpoch": 5,
  "network": "dev",
  "networkChaos": null,
  "dbChaos": null,
  "backgroundStreams": null
}'

export FORK_TEST_CONFIG="$FORK_CONFIG"

for iter in {1..5}; do
    echo "Iteration $iter/5..."
    npx vitest run forks/forks.test.ts \
        --pool=threads \
        --poolOptions.singleThread=true \
        --fileParallelism=false \
        > "$RESULTS_DIR/forks_iter${iter}.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✓ forks iteration $iter: PASS"
        FORKS_RESULTS[$iter]="PASS"
    else
        echo "✗ forks iteration $iter: FAIL"
        FORKS_RESULTS[$iter]="FAIL"
    fi
    sleep 2
done

echo ""
echo "=========================================="
echo "Results Summary"
echo "=========================================="
echo ""
echo "Concurrency: ${CONCURRENCY_RESULTS[@]}"
echo "Forks: ${FORKS_RESULTS[@]}"
echo ""
echo "Logs saved to: $RESULTS_DIR"
echo ""

# Generate quick CSV
echo "Suite Name,iter1,iter2,iter3,iter4,iter5" > "$RESULTS_DIR/results.csv"
echo "concurrency,${CONCURRENCY_RESULTS[1]},${CONCURRENCY_RESULTS[2]},${CONCURRENCY_RESULTS[3]},${CONCURRENCY_RESULTS[4]},${CONCURRENCY_RESULTS[5]}" >> "$RESULTS_DIR/results.csv"
echo "forks,${FORKS_RESULTS[1]},${FORKS_RESULTS[2]},${FORKS_RESULTS[3]},${FORKS_RESULTS[4]},${FORKS_RESULTS[5]}" >> "$RESULTS_DIR/results.csv"

cat "$RESULTS_DIR/results.csv"


