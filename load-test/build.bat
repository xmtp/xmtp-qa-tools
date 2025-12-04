@echo off
REM Build Artillery processor from TypeScript to JavaScript (Windows)

echo 🔨 Building Artillery processor...

REM Use esbuild to bundle the processor
call npx esbuild artillery-processor.ts ^
  --bundle ^
  --platform=node ^
  --format=cjs ^
  --outfile=artillery-processor.js ^
  --external:@xmtp/node-sdk ^
  --external:@xmtp/content-type-* ^
  --external:viem ^
  --external:@noble/* ^
  --target=node18

echo ✅ Build complete: artillery-processor.js


