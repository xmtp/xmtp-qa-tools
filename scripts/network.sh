#!/bin/bash

# Endpoint to be monitored
ENDPOINT="https://grpc.dev.xmtp.network:443"

# Make a request to the endpoint and capture timing information
response=$(curl -s -w "\n{\"DNS Lookup\": %{time_namelookup}, \"TCP Connection\": %{time_connect}, \"TLS Handshake\": %{time_appconnect}, \"Server Processing\": %{time_starttransfer}, \"Content Transfer\": %{time_total}}\n" -o /dev/null $ENDPOINT)

# Output the JSON response
echo $response