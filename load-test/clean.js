#!/usr/bin/env node
/**
 * Cross-platform clean script
 */

import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const itemsToClean = [
  'data',
  'dist',
  'report.json',
  'report.html',
  'artillery-config-auto.yml',
];

console.log('🧹 Cleaning build artifacts...');

for (const item of itemsToClean) {
  if (existsSync(item)) {
    try {
      rmSync(item, { recursive: true, force: true });
      console.log(`  ✓ Removed ${item}`);
    } catch (error) {
      console.warn(`  ⚠ Failed to remove ${item}:`, error.message);
    }
  }
}

console.log('✅ Clean complete');

