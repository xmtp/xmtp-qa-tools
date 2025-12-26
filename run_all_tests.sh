#!/bin/bash

# Script to run all test suites 5 times each with D14N enabled
# Results will be saved to /tmp/test_results/

export XMTP_D14N=true
export XMTP_API_URL=https://grpc.testnet-staging.xmtp.network:443

RESULTS_DIR="/tmp/test_results"
mkdir -p "$RESULTS_DIR"

# Test suite definitions (name:file_path)
declare -a TESTS=(
    "delivery:monitoring/delivery.test.ts"
    "performance:monitoring/performance.test.ts"
    "402restart:monitoring/bugs/402restart.test.ts"
    "stitch:monitoring/bugs/stitch.test.ts"
    "verifyallinstalls:monitoring/bugs/verifyallinstalls.test.ts"
    "perf-matrix:measurements/perf-matrix.test.ts"
    "concurrency:measurements/concurrency.test.ts"
    "bysize:inboxes/bysize.test.ts"
    "forks:forks/forks.test.ts"
)

# Track results for CSV generation
declare -A RESULTS

cd /home/ubuntu/xmtp-qa-tools

echo "Starting test suite execution with D14N mode..."
echo "API URL: $XMTP_API_URL"
echo "D14N Enabled: $XMTP_D14N"
echo ""

# Run each test suite 5 times
for test_def in "${TESTS[@]}"; do
    IFS=':' read -r test_name test_file <<< "$test_def"
    
    echo "=========================================="
    echo "Running test suite: $test_name"
    echo "Test file: $test_file"
    echo "=========================================="
    
    for iter in {1..5}; do
        echo ""
        echo "--- Iteration $iter/5 for $test_name ---"
        
        log_file="$RESULTS_DIR/${test_name}_iter${iter}.log"
        
        # Run the test
        npx vitest run "$test_file" \
            --pool=threads \
            --poolOptions.singleThread=true \
            --fileParallelism=false \
            > "$log_file" 2>&1
        
        exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
            result="PASS"
            echo "✓ $test_name iteration $iter: PASS"
        else
            result="FAIL"
            echo "✗ $test_name iteration $iter: FAIL"
        fi
        
        # Store result
        RESULTS["${test_name}_iter${iter}"]="$result"
        
        # Small delay between iterations
        sleep 2
    done
    
    echo ""
    echo "Completed all iterations for $test_name"
    echo ""
done

# Generate CSV output
echo ""
echo "=========================================="
echo "Generating CSV results..."
echo "=========================================="

csv_file="$RESULTS_DIR/results.csv"

# CSV Header
echo "Suite Name,iter1,iter2,iter3,iter4,iter5" > "$csv_file"

# CSV Rows
for test_def in "${TESTS[@]}"; do
    IFS=':' read -r test_name test_file <<< "$test_def"
    
    row="$test_name"
    for iter in {1..5}; do
        result="${RESULTS[${test_name}_iter${iter}]}"
        row="$row,$result"
    done
    echo "$row" >> "$csv_file"
done

echo ""
echo "CSV results saved to: $csv_file"
echo ""
cat "$csv_file"
echo ""
echo "All tests completed!"
echo "Individual logs available in: $RESULTS_DIR"


