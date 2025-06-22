#!/bin/bash

# Handle Ctrl+C to exit the entire script cleanly
trap 'echo -e "\n\nScript interrupted by user. Exiting..."; exit 0' INT

num_runs=50



rm -rf logs/
rm -rf .data/

echo "Starting test cycle at $(date)"
for ((i=1; i<=num_runs; i++)); do
    echo "Running test iteration $i of $num_runs"
    yarn test suites/commits/commits.test.ts  --no-fail
    exit_code=$?
    
    # Continue regardless of test pass/fail - only Ctrl+C (handled by trap) should stop
    echo "Test iteration $i completed with exit code $exit_code"
done
 
echo "Completed $num_runs iterations. Waiting 1 minute before next cycle..."

echo "Cleaning up..."

yarn ansi

echo "Finished cleaning up"
fork_count=$(find logs/cleaned -type f 2>/dev/null | wc -l)
echo "Found $fork_count forks in logs/cleaned"

echo "Done"