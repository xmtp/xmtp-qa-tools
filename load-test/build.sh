#!/bin/bash
# Build Artillery processor from TypeScript to JavaScript

echo "🔨 Building Artillery processor..."

# Use esbuild to bundle the processor
npx esbuild artillery-processor.ts \
  --bundle \
  --platform=node \
  --format=cjs \
  --outfile=artillery-processor.js \
  --external:@xmtp/agent-sdk \
  --external:@xmtp/content-type-* \
  --external:viem \
  --external:@noble/* \
  --target=node18

echo "✅ Build complete: artillery-processor.js"

