#!/usr/bin/env node
/**
 * Cross-platform build script for Artillery processor
 * Compiles TypeScript files individually (no bundling)
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

console.log('🔨 Building load test files...');

try {
  // Use TypeScript compiler to build all .ts files
  // This compiles but doesn't bundle, keeping imports intact
  const tscCmd = process.platform === 'win32' ? 'npx.cmd tsc' : 'npx tsc';
  
  console.log('Compiling TypeScript files...');
  execSync(tscCmd, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd()
  });
  
  // Verify the critical files were built
  const requiredFiles = [
    'dist/artillery-processor.js',
    'dist/xmtp-helpers.js',
    'dist/workload-config.js'
  ];
  
  const missing = requiredFiles.filter(f => !existsSync(f));
  
  if (missing.length > 0) {
    console.error('❌ Build failed: missing files:', missing);
    process.exit(1);
  }
  
  console.log('✅ Build complete');
  console.log('   Output: dist/ directory');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}


