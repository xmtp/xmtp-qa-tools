#!/bin/bash

printed_header=false
last_raw_files=()

while IFS= read -r entry; do
  name=$(basename "$entry")

  if [[ "$name" == raw-*.log ]]; then
    last_raw_files+=("$name")

  elif [[ "$name" == cleaned-* ]]; then
    # Count forks in previous raw logs
    num_forks=0
    for logfile in "${last_raw_files[@]}"; do
      if grep -q "forked" "$logfile"; then
        ((num_forks++))
      fi
    done
    last_raw_files=()

    env_file="$name/env-vars.txt"
    if [[ -f "$env_file" ]]; then
      # Extract and print header only once
      if [ "$printed_header" = false ]; then
        env_headers=$(awk -F= '{print $1}' "$env_file" | paste -sd, -)
        echo "name,num_logs,num_forks,$env_headers"
        printed_header=true
      fi

      # Extract values, replacing commas with dashes in each value
      env_values=$(awk -F= '{gsub(/,/, "-", $2); print $2}' "$env_file" | paste -sd, -)
      num_logs=$(find "$name" -maxdepth 1 -type f -name '*.log' | wc -l)
      echo "$name,$num_logs,$num_forks,$env_values"
    fi
  fi
done < <(ls -1tr)
