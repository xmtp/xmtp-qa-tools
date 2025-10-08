#!/usr/bin/env node
/**
 * Main CLI Entry Point
 * 
 * Auto-discovers and runs commands from the commands/ directory
 */

import { runCLI } from './runner.js';

runCLI().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
