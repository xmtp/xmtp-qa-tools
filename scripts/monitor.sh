# Create a monitoring script (monitor.sh):
#!/bin/bash

# Create log directory if it doesn't exist
LOG_DIR="$PWD"
LOG_FILE="$LOG_DIR/logs/grpc_timing.log"

echo "Starting monitoring... Logs will be saved to $LOG_FILE"
echo "Press Ctrl+C to stop"

while true; do
  date "+%Y-%m-%d %H:%M:%S" >> "$LOG_FILE"
  start=$(date +%s.%N)
  curl -s -w "\n  DNS Lookup   TCP Connection   TLS Handshake   Server Processing   Content Transfer\n[  %{time_namelookup}ms  |  %{time_connect}ms  |  %{time_appconnect}ms  |  %{time_pretransfer}ms  |  %{time_starttransfer}ms  ]\n             |                |               |                   |                  |\n    namelookup:%{time_namelookup}ms           |               |                   |                  |\n                        connect:%{time_connect}ms          |                   |                  |\n                                    pretransfer:%{time_pretransfer}ms             |                  |\n                                                      starttransfer:%{time_starttransfer}ms            |\n                                                                                 total:%{time_total}ms  \n" https://grpc.dev.xmtp.network:443 -o /dev/null >> "$LOG_FILE"
  echo "pc-message: invalid gRPC request content-type \"\"" >> "$LOG_FILE"
  echo "Body stored in: /var/folders/z_/h8kpywgj7gx5b_fmn20_yzx40000gn/T/tmprkhp9dbv" >> "$LOG_FILE"
  echo "-------------------" >> "$LOG_FILE"
  sleep 2
done