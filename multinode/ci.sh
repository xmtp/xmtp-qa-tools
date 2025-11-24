#!/bin/bash
script_dir="$(cd $(dirname $0) && pwd)"
pushd $script_dir >/dev/null
echo "Tearing down and starting Docker environment..."

for x in {1..100}; {
  echo "Attempt $x..."
  docker compose down
  docker compose pull
  docker compose up -d --wait
  echo "Waiting 15 seconds before checking liveliness..."
  sleep 15

  NODE_COUNT=$(docker ps --filter "ancestor=ghcr.io/xmtp/node-go:main" --format "{{.ID}}" | wc -l)
  [ "$NODE_COUNT" -eq 4 ] && echo "Found $NODE_COUNT XMTP node(s) running" && exit 0
  echo "Error: Expected 4 XMTP nodes to be running."
  docker ps
}

echo "Could not start XMTP nodes after 5 attempts, exiting" && exit 1

popd >/dev/null
