#!/bin/bash

# Handle Ctrl+C to exit the entire script cleanly
trap 'echo -e "\n\nScript interrupted by user. Exiting..."; exit 0' INT

# Remove logs and .data as before

echo "Script started at $(date)"
echo "Removing logs/"
rm -rf logs/

echo "Removing .data/"
rm -rf .data/

# Don't sleep the computer
caffeinate -d &
CAFFEINATE_PID=$!
echo "Caffeinate started with PID: $CAFFEINATE_PID"

MAX_RETRIES=3

# Function to run command with retry
run_with_retry() {
    local attempt=1
    while [ $attempt -le $MAX_RETRIES ]; do
        echo "Running test (attempt $attempt/$MAX_RETRIES)"
        echo "Command: yarn gen $@"
        echo "Starting yarn gen at $(date)"
        yarn gen "$@"
        local exit_code=$?
        echo "Yarn gen completed at $(date) with exit code: $exit_code"
        if [ $exit_code -eq 130 ]; then
            echo "Command interrupted by user, exiting..."
            exit 0
        fi
        if [ $exit_code -eq 0 ]; then
            echo "✓ Successfully completed test"
            return 0
        fi
        echo "✗ Test failed with exit code $exit_code"
        if [ $attempt -lt $MAX_RETRIES ]; then
            echo "Retrying in 60 seconds to avoid rate limits..."
            sleep 2
        fi
        ((attempt++))
    done
    echo "✗ Failed all $MAX_RETRIES attempts"
    return 1
}

echo "Starting test cycle at $(date)"

# Parse arguments to find --installations and its value
INSTALLATIONS_ARG=""
INSTALLATIONS_VALUE=""
OTHER_ARGS=()

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --installations)
      INSTALLATIONS_ARG="--installations"
      INSTALLATIONS_VALUE="$2"
      shift # past argument
      shift # past value
      ;;
    --installations=*)
      INSTALLATIONS_ARG="--installations"
      INSTALLATIONS_VALUE="${key#*=}"
      shift # past argument=value
      ;;
    *)
      OTHER_ARGS+=("$1")
      shift # past argument
      ;;
  esac
done

if [[ -n "$INSTALLATIONS_VALUE" && "$INSTALLATIONS_VALUE" == *,* ]]; then
  IFS=',' read -ra INSTALLATION_LIST <<< "$INSTALLATIONS_VALUE"
  for inst in "${INSTALLATION_LIST[@]}"; do
    echo "\n--- Running for --installations $inst ---"
    run_with_retry "${OTHER_ARGS[@]}" $INSTALLATIONS_ARG "$inst"
    if [ $? -ne 0 ]; then
      echo "✗ Failed for --installations $inst. Exiting."
      exit 1
    fi
  done
else
  # No comma, just run as before
  if [[ -n "$INSTALLATIONS_ARG" ]]; then
    run_with_retry "${OTHER_ARGS[@]}" $INSTALLATIONS_ARG "$INSTALLATIONS_VALUE"
  else
    run_with_retry "${OTHER_ARGS[@]}"
  fi
fi

echo "✓ Completed all installation tests at $(date)"