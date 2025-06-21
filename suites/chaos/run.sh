#!/bin/bash

# Handle Ctrl+C to exit the entire script cleanly
trap 'echo -e "\n\nScript interrupted by user. Exiting..."; exit 0' INT

while true; do
    echo "Starting test cycle at $(date)"
    for i in {1..100}; do
        echo "Running test iteration $i of 100"
        yarn test suites/chaos/commits.test.ts --debug --no-fail
        exit_code=$?
        
        # Continue regardless of test pass/fail - only Ctrl+C (handled by trap) should stop
        echo "Test iteration $i completed with exit code $exit_code"
    done
    echo "Completed 100 iterations. Waiting 1 minute before next cycle..."
    sleep 60
done