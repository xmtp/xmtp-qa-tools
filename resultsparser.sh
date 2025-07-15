#!/bin/bash

echo "name,GROUP_COUNT,PARALLEL_OPS,CHAOS_LATENCY_MS,CHAOS_JITTER_MS,CHAOS_PACKET_LOSS_PCT,CHAOS_EGRESS_LATENCY_MS,CHAOS_EGRESS_JITTER_MS,CHAOS_EGRESS_PACKET_LOSS_PCT,INSTALLATION_COUNT,WORKER_COUNT,RANDOM_INBOX_IDS,TARGET_EPOCH,XMTP_ENV,num_logs,num_forks"

last_raw_files=()

while IFS= read -r entry; do
  name=$(basename "$entry")

  if [[ "$name" == raw-*.log ]]; then
    last_raw_files+=("$name")

  elif [[ "$name" == cleaned-* ]]; then
    # Count how many of the previous raw log files contain "forked"
    num_forks=0
    for logfile in "${last_raw_files[@]}"; do
      if grep -q "forked" "$logfile"; then
        ((num_forks++))
      fi
    done

    # Reset raw files accumulator for next cleaned folder
    last_raw_files=()

    # Extract env values and count logs
    if [[ -f "$name/env-vars.txt" ]]; then
      values=$(awk -F= '{print $2}' "$name/env-vars.txt" | paste -sd, -)
      num_logs=$(find "$name" -maxdepth 1 -type f -name '*.log' | wc -l)
      echo "$name,$values,$num_logs,$num_forks"
    fi
  fi
done < <(ls -1tr)