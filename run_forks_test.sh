#!/bin/bash

# Run forks test with proper configuration
export XMTP_D14N=true
export XMTP_API_URL=https://grpc.testnet-staging.xmtp.network:443
export XMTP_ENV=dev

# Simple fork test config - minimal settings for quick test
FORK_CONFIG='{
  "groupCount": 2,
  "parallelOperations": 2,
  "targetEpoch": 3,
  "network": "dev",
  "networkChaos": null,
  "dbChaos": null,
  "backgroundStreams": null
}'

export FORK_TEST_CONFIG="$FORK_CONFIG"

RESULTS_DIR="/tmp/test_results_forks"
mkdir -p "$RESULTS_DIR"

cd /home/ubuntu/xmtp-qa-tools

echo "=========================================="
echo "Running forks test (5 iterations)"
echo "D14N: $XMTP_D14N"
echo "API URL: $XMTP_API_URL"
echo "=========================================="
echo ""

declare -A RESULTS

for iter in {1..5}; do
    echo "--- Iteration $iter/5 ---"
    
    npx vitest run forks/forks.test.ts \
        --pool=threads \
        --poolOptions.singleThread=true \
        --fileParallelism=false \
        > "$RESULTS_DIR/forks_iter${iter}.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✓ forks iteration $iter: PASS"
        RESULTS[$iter]="PASS"
    else
        echo "✗ forks iteration $iter: FAIL"
        RESULTS[$iter]="FAIL"
    fi
    
    sleep 2
done

echo ""
echo "=========================================="
echo "Forks Test Complete!"
echo "=========================================="
echo "Results: ${RESULTS[@]}"
echo ""
echo "Suite Name,iter1,iter2,iter3,iter4,iter5"
echo "forks,${RESULTS[1]},${RESULTS[2]},${RESULTS[3]},${RESULTS[4]},${RESULTS[5]}"


