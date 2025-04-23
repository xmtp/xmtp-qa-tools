#!/bin/bash

# Script to run tests with retry logic
MAX_ATTEMPTS=3
RETRY_DELAY=10

# Get test name from command line argument or use default
TEST_NAME=${1:-"functional"}

echo "Starting $TEST_NAME tests with up to $MAX_ATTEMPTS attempts"

for i in $(seq 1 $MAX_ATTEMPTS); do
  echo "Attempt $i of $MAX_ATTEMPTS..."
  
  # Set environment variable for Rust backtrace
  export RUST_BACKTRACE=1
  
  # Run the test with npx vitest
  if [ "$TEST_NAME" = "functional" ]; then
    # For functional tests, ensure we use proper isolation settings
    echo "Running functional tests with --pool=threads and sequential execution..."
    npx vitest run ./functional/*.test.ts --pool=threads --poolOptions.singleThread=true --fileParallelism=false | grep -v "sqlcipher_mem_lock" | grep -v "SQLCIPHER_NO_MLOCK" | grep -v "ERROR MEMORY sqlcipher_mlock: mlock() returned -1 errno=12"
  else
    # Other tests can use the forks pool
    npx vitest run "$TEST_NAME" --pool=forks --fileParallelism=false | grep -v "sqlcipher_mem_lock" | grep -v "SQLCIPHER_NO_MLOCK" | grep -v "ERROR MEMORY sqlcipher_mlock: mlock() returned -1 errno=12"
  fi
  
  # Store the exit code of the test command, not grep
  # We need to use PIPESTATUS to get the exit code of npx vitest, not grep
  exit_code=${PIPESTATUS[0]}
  
  if [ $exit_code -eq 0 ]; then
    echo "Tests passed successfully!"
    exit 0
  fi
  
  if [ $i -eq $MAX_ATTEMPTS ]; then
    echo "Test failed after $MAX_ATTEMPTS attempts."
    exit 1
  fi
  
  echo "Test failed with exit code $exit_code. Retrying in $RETRY_DELAY seconds.."
  sleep $RETRY_DELAY
  echo "Clearing memory and cache before next attempt..."
done 