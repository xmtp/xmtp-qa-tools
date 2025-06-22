#!/bin/bash

# Handle Ctrl+C to exit the entire script cleanly
trap 'echo -e "\n\nScript interrupted by user. Exiting..."; exit 0' INT

# Function to detect forks in log files
detect_forks() {
    if [ ! -d "logs/" ]; then   
        echo 0
        return
    fi
    
    local fork_count=$(grep -r -i "fork" logs/ 2>/dev/null | wc -l)
    echo $fork_count
}

rm -rf logs/
rm -rf .data/

echo "Starting test cycle at $(date)"
for i in {1..20}; do
        echo "Running test iteration $i of 100"
        yarn test suites/chaos/commits.test.ts --debug --no-fail
        exit_code=$?
        
        # Check for forks after each test
        fork_count=$(detect_forks)
        # echo "Fork detection: Found $fork_count fork mentions in logs"
        
        if [ $fork_count -gt 0 ]; then
            echo "FORK DETECTED! Found $fork_count fork occurrences. Stopping test cycle."
            # exit 1
        fi
        
        # Continue regardless of test pass/fail - only Ctrl+C (handled by trap) should stop
        echo "Test iteration $i completed with exit code $exit_code"
done
 echo "Completed 100 iterations. Waiting 1 minute before next cycle..."