#!/bin/bash

XMTP_ENV="local"

# Matrix params
DURATION_MS_LIST=(300)
CHAOS_LATENCY_MS_LIST=(0 100)
CHAOS_JITTER_MS_LIST=(0 50)
CHAOS_PACKET_LOSS_PCT_LIST=(0 10)
CHAOS_EGRESS_LATENCY_MS_LIST=(50)
CHAOS_EGRESS_JITTER_MS_LIST=(0)
CHAOS_EGRESS_PACKET_LOSS_PCT_LIST=(0)
WORKER_COUNTS=(10 20)

# Enabled ops permutations (modify/add/remove as needed)
ENABLED_OPS_LIST=(
  "sendMessage,verify,modifyMembership"
  "sendMessage,verify,updateName"
  "sendMessage,verify,promoteAdmin,demoteAdmin"
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
