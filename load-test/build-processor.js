#!/usr/bin/env node
/**
 * Cross-platform build script for Artillery processor
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

console.log('🔨 Building Artillery processor...');

try {
  // Check if esbuild is available
  const esbuildCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  
  execSync(`${esbuildCmd} esbuild artillery-processor.ts --bundle --platform=node --format=cjs --outfile=artillery-processor.cjs --external:@xmtp/node-sdk --external:@xmtp/content-type-* --external:viem --external:@noble/* --external:uint8arrays --target=node18`, {
    stdio: 'inherit',
    shell: true
  });
  
  if (existsSync('./artillery-processor.cjs')) {
    console.log('✅ Build complete: artillery-processor.cjs');
  } else {
    console.error('❌ Build failed: output file not created');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}


