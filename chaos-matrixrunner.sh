#!/bin/bash

XMTP_ENV="local"

# Resume from this test number (1-based index)
RESUME_FROM=1

# Matrix parameters
DURATION_MS_LIST=(300000)
CHAOS_LATENCY_MS_LIST=(0 100)
CHAOS_JITTER_MS_LIST=(0 100)
CHAOS_PACKET_LOSS_PCT_LIST=(0 10)
CHAOS_EGRESS_LATENCY_MS_LIST=(0 100)
CHAOS_EGRESS_JITTER_MS_LIST=(0 100)
CHAOS_EGRESS_PACKET_LOSS_PCT_LIST=(0 10)
WORKER_COUNTS=(10 100 200)
OP_FREQS=(30000 10000 2000)

# Enabled ops permutations (modify/add/remove as needed)
ENABLED_OPS_LIST=(
  "verify,modifyMembership"
  "verify,updateName"
  "verify,promoteAdmin,demoteAdmin"
)

i=1

for DURATION_MS in "${DURATION_MS_LIST[@]}"; do
for CHAOS_LATENCY_MS in "${CHAOS_LATENCY_MS_LIST[@]}"; do
for CHAOS_JITTER_MS in "${CHAOS_JITTER_MS_LIST[@]}"; do
for CHAOS_PACKET_LOSS_PCT in "${CHAOS_PACKET_LOSS_PCT_LIST[@]}"; do
for CHAOS_EGRESS_LATENCY_MS in "${CHAOS_EGRESS_LATENCY_MS_LIST[@]}"; do
for CHAOS_EGRESS_JITTER_MS in "${CHAOS_EGRESS_JITTER_MS_LIST[@]}"; do
for CHAOS_EGRESS_PACKET_LOSS_PCT in "${CHAOS_EGRESS_PACKET_LOSS_PCT_LIST[@]}"; do
for WORKER_COUNT in "${WORKER_COUNTS[@]}"; do
for ENABLED_OPS in "${ENABLED_OPS_LIST[@]}"; do
for OP_FREQ in "${OP_FREQS[@]}"; do

  # Skip previously completed runs
  if (( i < RESUME_FROM )); then
    ((i++))
    continue
  fi

  # Check disk usage on root filesystem
  ROOT_USE=$(df / | awk 'NR==2 {gsub("%",""); print $5}')
  if (( ROOT_USE >= 95 )); then
    echo ""
    echo "=> Disk usage on / is ${ROOT_USE}% � aborting test run."
    echo "=> Resume next time from: RESUME_FROM=$i"
    exit 1
  fi

  echo ""
  echo "========================================================="
  echo "Running matrix config:"
  echo "DURATION_MS=$DURATION_MS"
  echo "CHAOS_LATENCY_MS=$CHAOS_LATENCY_MS"
  echo "CHAOS_JITTER_MS=$CHAOS_JITTER_MS"
  echo "CHAOS_PACKET_LOSS_PCT=$CHAOS_PACKET_LOSS_PCT"
  echo "CHAOS_EGRESS_LATENCY_MS=$CHAOS_EGRESS_LATENCY_MS"
  echo "CHAOS_EGRESS_JITTER_MS=$CHAOS_EGRESS_JITTER_MS"
  echo "CHAOS_EGRESS_PACKET_LOSS_PCT=$CHAOS_EGRESS_PACKET_LOSS_PCT"
  echo "WORKER_COUNT=$WORKER_COUNT"
  echo "OP_FREQ=$OP_FREQ"
  echo "ENABLED_OPS=$ENABLED_OPS"
  echo "XMTP_ENV=$XMTP_ENV"
  echo "========================================================="

  export DURATION_MS
  export CHAOS_LATENCY_MS
  export CHAOS_JITTER_MS
  export CHAOS_PACKET_LOSS_PCT
  export CHAOS_EGRESS_LATENCY_MS
  export CHAOS_EGRESS_JITTER_MS
  export CHAOS_EGRESS_PACKET_LOSS_PCT
  export WORKER_COUNT
  export OP_FREQ
  export ENABLED_OPS
  export XMTP_ENV

  echo "Starting with configuration $i..."
  ./chaossuite-batchrunner.sh
  ((i++))

done
done
done
done
done
done
done
done
done
done
