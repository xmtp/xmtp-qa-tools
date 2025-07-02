#!/bin/bash

# Handle Ctrl+C to exit the entire script cleanly
trap 'echo -e "\n\nScript interrupted by user. Exiting..."; exit 0' INT

num_runs=10

rm -f logs/*log # DON'T remove the entire dir as all the cleaned results dirs are here
rm -rf .data/

tranche_parts=5
tranche=$((num_runs/tranche_parts))

for x in {1..$tranche_parts}; {
  echo "Starting test cycle at $(date)"
  for ((i=1; i<=tranche; i++)); do
      echo "Restarting multinode docker env..."
      cd multinode && docker compose down && ./ci.sh && cd ..
      sleep 10
      echo "Running test iteration $i of $num_runs in tranche $tranche_parts"
      yarn test suites/commits/commits.test.ts  --no-fail --debug
      exit_code=$?

      # Continue regardless of test pass/fail - only Ctrl+C (handled by trap) should stop
      echo "Test iteration $i completed with exit code $exit_code"
  done

  echo "Cleaning up..."

  yarn ansi
  echo "Finished cleaning up"
  fork_count=$(find logs/cleaned -type f 2>/dev/null | wc -l)
  echo "Found $fork_count forks in logs/cleaned"

echo "Writing env config to output dir..."

{
  echo "GROUP_COUNT=$GROUP_COUNT"
  echo "PARALLEL_OPS=$PARALLEL_OPS"
  echo "CHAOS_LATENCY_MS=$CHAOS_LATENCY_MS"
  echo "CHAOS_JITTER_MS=$CHAOS_JITTER_MS"
  echo "CHAOS_PACKET_LOSS_PCT=$CHAOS_PACKET_LOSS_PCT"
  echo "CHAOS_EGRESS_LATENCY_MS=$CHAOS_EGRESS_LATENCY_MS"
  echo "CHAOS_EGRESS_JITTER_MS=$CHAOS_EGRESS_JITTER_MS"
  echo "CHAOS_EGRESS_PACKET_LOSS_PCT=$CHAOS_EGRESS_PACKET_LOSS_PCT"
  echo "INSTALLATION_COUNT=$INSTALLATION_COUNT"
  echo "WORKER_COUNT=$WORKER_COUNT"
  echo "RANDOM_INBOX_IDS=$RANDOM_INBOX_IDS"
  echo "TARGET_EPOCH=$TARGET_EPOCH"
  echo "ENABLED_OPS=$ENABLED_OPS"
  echo "XMTP_ENV=$XMTP_ENV"
} > "logs/cleaned/env-vars.txt"

logdir="logs/cleaned-$(date +%s)"
mv logs/cleaned ${logdir}
echo "Moved logs/cleaned to $logdir"

echo "Done"