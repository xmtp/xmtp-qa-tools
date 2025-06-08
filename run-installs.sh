#!/bin/bash

# Handle Ctrl+C to exit the entire script cleanly
trap 'echo -e "\n\nScript interrupted by user. Exiting..."; exit 0' INT

rm -rf logs

# Array of installations values
INSTALLATIONS=(10 15 20 25)
MAX_RETRIES=3

# Function to run command with retry
run_with_retry() {
    local installations=$1
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        echo "Running test with installations $installations (attempt $attempt/$MAX_RETRIES)"
        yarn gen --mode generate-inboxes --count 200 --envs local,production --installations $installations
        
        local exit_code=$?
        
        # Check if command was interrupted (Ctrl+C)
        if [ $exit_code -eq 130 ]; then
            echo "Command interrupted by user, exiting..."
            exit 0
        fi
        
        # If successful, break out of retry loop
        if [ $exit_code -eq 0 ]; then
            echo "✓ Successfully completed test with installations $installations"
            return 0
        fi
        
        echo "✗ Test failed with exit code $exit_code"
        
        # If not the last attempt, wait before retrying
        if [ $attempt -lt $MAX_RETRIES ]; then
            echo "Retrying in 10 seconds..."
            sleep 10
        fi
        
        ((attempt++))
    done
    
    echo "✗ Failed all $MAX_RETRIES attempts for installations $installations"
    return 1
}

echo "Starting test cycle at $(date)"

# Run tests for each installations value
for installations in "${INSTALLATIONS[@]}"; do
    run_with_retry $installations
    
    # Small delay between different installation tests
    sleep 5
done

echo "✓ Completed all installation tests at $(date)"