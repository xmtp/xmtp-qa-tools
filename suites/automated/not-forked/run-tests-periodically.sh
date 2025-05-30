#!/bin/bash

while true; do
    echo "Starting test cycle at $(date)"
    for i in {1..3}; do
        echo "Running test iteration $i of 3"
        yarn test not-forked --debug-verbose
    done
    echo "Waiting 30 minutes before next cycle..."
    sleep 1800
done 