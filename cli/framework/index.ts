/**
 * CLI Framework - Main Exports
 * 
 * A React-like declarative framework for building AI-discoverable CLI commands
 */

export { defineCommand, parseArgs, generateHelp, executeCommand } from './command.js';
export { option } from './option-builders.js';
export type { 
  CommandDefinition, 
  CommandOptions, 
  CommandContext, 
  ResolvedOptions,
  OptionDefinition,
  CommandResult,
} from './types.js';
