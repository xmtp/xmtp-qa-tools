#!/bin/bash

XMTP_ENV="local"

# Matrix params
GROUP_COUNTS=(5)
PARALLEL_OPS_LIST=(1)
CHAOS_LATENCY_MS_LIST=(0)
CHAOS_JITTER_MS_LIST=(0)
CHAOS_PACKET_LOSS_PCT_LIST=(0)
CHAOS_EGRESS_LATENCY_MS_LIST=(0)
CHAOS_EGRESS_JITTER_MS_LIST=(0)
CHAOS_EGRESS_PACKET_LOSS_PCT_LIST=(0)
INSTALLATION_COUNTS=(5)
WORKER_COUNTS=(10)
RANDOM_INBOX_IDS_LIST=(30)
TARGET_EPOCHS=(100)
ENABLED_OPS_LIST=(
  "sendMessage,updateName"
  "addMember,removeMember,sendMessage"
  "sendMessage,createInstallation"
  "updateName,createInstallation"
  "updateName,addMember,removeMember,createInstallation,sendMessage"
)

i=1

for GROUP_COUNT in "${GROUP_COUNTS[@]}"; do
for PARALLEL_OPS in "${PARALLEL_OPS_LIST[@]}"; do
for CHAOS_LATENCY_MS in "${CHAOS_LATENCY_MS_LIST[@]}"; do
for CHAOS_JITTER_MS in "${CHAOS_JITTER_MS_LIST[@]}"; do
for CHAOS_PACKET_LOSS_PCT in "${CHAOS_PACKET_LOSS_PCT_LIST[@]}"; do
for CHAOS_EGRESS_LATENCY_MS in "${CHAOS_EGRESS_LATENCY_MS_LIST[@]}"; do
for CHAOS_EGRESS_JITTER_MS in "${CHAOS_EGRESS_JITTER_MS_LIST[@]}"; do
for CHAOS_EGRESS_PACKET_LOSS_PCT in "${CHAOS_EGRESS_PACKET_LOSS_PCT_LIST[@]}"; do
for INSTALLATION_COUNT in "${INSTALLATION_COUNTS[@]}"; do
for WORKER_COUNT in "${WORKER_COUNTS[@]}"; do
for RANDOM_INBOX_IDS in "${RANDOM_INBOX_IDS_LIST[@]}"; do
for TARGET_EPOCH in "${TARGET_EPOCHS[@]}"; do
for ENABLED_OPS in "${ENABLED_OPS_LIST[@]}"; do

  echo ""
  echo "========================================================="
  echo "Running matrix config:"
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
  echo "========================================================="

  export GROUP_COUNT
  export PARALLEL_OPS
  export CHAOS_LATENCY_MS
  export CHAOS_JITTER_MS
  export CHAOS_PACKET_LOSS_PCT
  export CHAOS_EGRESS_LATENCY_MS
  export CHAOS_EGRESS_JITTER_MS
  export CHAOS_EGRESS_PACKET_LOSS_PCT
  export INSTALLATION_COUNT
  export WORKER_COUNT
  export RANDOM_INBOX_IDS
  export TARGET_EPOCH
  export ENABLED_OPS
  export XMTP_ENV

  # Kick off the tests
  echo "Starting with configuration $i..."
  yarn run:commitsmatrix
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
done
done
done
