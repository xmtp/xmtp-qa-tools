#!/bin/bash

# Handle Ctrl+C to exit the entire script cleanly
trap 'echo -e "\n\nScript interrupted by user. Exiting..."; exit 0' INT

rm -rf logs

while true; do
    echo "Starting test cycle at $(date)"
    for i in {1..10}; do
        echo "Running test iteration $i of 10"
        yarn test suites/group/group.test.ts --debug-verbose --parallel
        
        # Check if the test command was interrupted
        if [ $? -ne 0 ] && [ $? -ne 1 ]; then
            echo "Test interrupted, exiting..."
            exit 0
        fi
    done
    echo "Waiting 30 minutes before next cycle..."
    sleep 1800
done 

