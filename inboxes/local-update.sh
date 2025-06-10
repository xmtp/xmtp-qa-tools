#!/bin/bash

# Handle Ctrl+C to exit the entire script cleanly
trap 'echo -e "\n\nScript interrupted by user. Exiting..."; exit 0' INT

echo "Script started at $(date)"

# Don't sleep the computer
caffeinate -d &
CAFFEINATE_PID=$!
echo "Caffeinate started with PID: $CAFFEINATE_PID"

# Array of installations values
INSTALLATIONS=(2 5 10 20)
MAX_RETRIES=3
ENVS=production
COUNT=500

echo "Arrays and variables initialized"

# Function to run command with retry
run_with_retry() {
    local installations=$1
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        echo "Running test with installations $installations (attempt $attempt/$MAX_RETRIES)"
        echo "Command: yarn gen --count $COUNT --envs $ENVS --installations $installations"
        echo "Starting yarn gen at $(date)"
        
        # Run yarn gen command directly
        yarn gen --envs local --installations $installations
        
        local exit_code=$?
        echo "Yarn gen completed at $(date) with exit code: $exit_code"
        
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
            echo "Retrying in 60 seconds to avoid rate limits..."
            sleep 60
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
    
    # 1 minute delay between different installation tests to avoid rate limits
    sleep 60
done

echo "✓ Completed all installation tests at $(date)"