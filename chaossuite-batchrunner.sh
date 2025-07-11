#!/bin/bash

# Handle Ctrl+C to exit the entire script cleanly
trap 'echo -e "\n\nScript interrupted by user. Exiting..."; exit 0' INT

num_runs=10

#rm -f logs/*log # DON'T remove the entire dir as all the cleaned results dirs are here

for ((x=1; x<=num_runs; x++)); do
  echo "Starting test cycle at $(date)"

  cd multinode && docker compose down && ./ci.sh && cd ..
  rm -rf .data
  sleep 10
  tid=$(date +%s)
  echo "Running test iteration $x of 10..." 

  #LOGGING_LEVEL="error" LOG_LEVEL="silly" timeout $DURATION_MS npx vitest run suites/networkchaos/forkmatrix.test.ts >& logs/raw-forkmatrix-${tid}.log
  #LOG_LEVEL=info timeout $DURATION_MS time yarn test suites/networkchaos/forkmatrix-streamonly.test.ts --debug
  LOGGING_LEVEL="error" LOG_LEVEL="silly" timeout 300 yarn test suites/networkchaos/forkmatrix-streamonly.test.ts --debug
  #LOG_LEVEL=info timeout 300 time npx vitest run suites/networkchaos/forkmatrix-streamonly.test.ts --pool=threads --poolOptions.singleThread=true --fileParallelism=false | tee test-${x}.log
  exit_code=$?

  echo "Test iteration $i completed with exit code $exit_code"

  echo "Cleaning up test logs and results..."
  yarn ansi
  echo "Finished cleaning up"
  fork_count=$(find logs/cleaned -type f 2>/dev/null | wc -l)
  echo "Found $fork_count forks in logs/cleaned"
done

echo "Writing env config to output dir..."

{
  echo "DURATION_MS=$DURATION_MS"
  echo "CHAOS_LATENCY_MS=$CHAOS_LATENCY_MS"
  echo "CHAOS_JITTER_MS=$CHAOS_JITTER_MS"
  echo "CHAOS_PACKET_LOSS_PCT=$CHAOS_PACKET_LOSS_PCT"
  echo "CHAOS_EGRESS_LATENCY_MS=$CHAOS_EGRESS_LATENCY_MS"
  echo "CHAOS_EGRESS_JITTER_MS=$CHAOS_EGRESS_JITTER_MS"
  echo "CHAOS_EGRESS_PACKET_LOSS_PCT=$CHAOS_EGRESS_PACKET_LOSS_PCT"
  echo "WORKER_COUNT=$WORKER_COUNT"
  echo "ENABLED_OPS=$ENABLED_OPS"
  echo "XMTP_ENV=$XMTP_ENV"
} > "logs/cleaned/env-vars.txt"

logdir="logs/cleaned-$(date +%s)"
mv logs/cleaned ${logdir}
echo "Moved logs/cleaned to $logdir"

echo "Done"
