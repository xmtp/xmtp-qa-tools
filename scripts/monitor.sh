# Create a monitoring script (monitor.sh):
#!/bin/bash

# Create log directory if it doesn't exist
LOG_DIR="$PWD"
LOG_FILE="$LOG_DIR/grpc_timing.log"

echo "Starting monitoring... Logs will be saved to $LOG_FILE"
echo "Press Ctrl+C to stop"

while true; do
  date "+%Y-%m-%d %H:%M:%S" >> "$LOG_FILE"
  start=$(date +%s.%N)
  curl -s https://grpc.dev.xmtp.network:443 > /dev/null
  end=$(date +%s.%N)
  runtime=$(echo "$end - $start" | bc)
  echo "Total time: ${runtime}s" | tee -a "$LOG_FILE"
  echo "-------------------" >> "$LOG_FILE"
  sleep 2
done