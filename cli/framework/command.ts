/**
 * Command Definition Utility
 * 
 * Main API for defining CLI commands in a declarative way
 */

import type { CommandDefinition, CommandOptions, CommandContext, ResolvedOptions } from './types.js';

export function defineCommand<T extends CommandOptions>(
  definition: CommandDefinition<T>
): CommandDefinition<T> {
  return definition;
}

/**
 * Parse command line arguments based on option definitions
 */
export function parseArgs<T extends CommandOptions>(
  args: string[],
  options: T
): ResolvedOptions<T> {
  const result: any = {};
  
  // Set defaults
  for (const [key, optDef] of Object.entries(options)) {
    if (optDef.default !== undefined) {
      result[key] = optDef.default;
    }
  }

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const optionName = arg.slice(2);
      const optDef = options[optionName];
      
      if (!optDef) {
        throw new Error(`Unknown option: ${arg}`);
      }

      if (optDef.type === 'boolean') {
        result[optionName] = true;
      } else {
        const value = args[i + 1];
        if (!value || value.startsWith('--')) {
          throw new Error(`Option ${arg} requires a value`);
        }
        
        if (optDef.type === 'number') {
          const num = parseFloat(value);
          if (isNaN(num)) {
            throw new Error(`Option ${arg} must be a number`);
          }
          result[optionName] = num;
        } else if (optDef.type === 'array') {
          const separator = (optDef as any).separator || ',';
          result[optionName] = value.split(separator);
        } else if (optDef.type === 'enum') {
          if (!optDef.choices?.includes(value)) {
            throw new Error(`Option ${arg} must be one of: ${optDef.choices?.join(', ')}`);
          }
          result[optionName] = value;
        } else {
          result[optionName] = value;
        }
        i++; // Skip the value
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      // Handle short aliases
      const alias = arg.slice(1);
      const optionEntry = Object.entries(options).find(([_, def]) => def.alias === alias);
      
      if (optionEntry) {
        const [optionName, optDef] = optionEntry;
        
        if (optDef.type === 'boolean') {
          result[optionName] = true;
        } else {
          const value = args[i + 1];
          if (!value || value.startsWith('-')) {
            throw new Error(`Option ${arg} requires a value`);
          }
          result[optionName] = value;
          i++;
        }
      }
    }
  }

  // Validate required options
  for (const [key, optDef] of Object.entries(options)) {
    if (optDef.required && result[key] === undefined) {
      throw new Error(`Required option --${key} is missing`);
    }
    
    // Run custom validation
    if (optDef.validate && result[key] !== undefined) {
      const validationResult = optDef.validate(result[key]);
      if (validationResult !== true) {
        const message = typeof validationResult === 'string' 
          ? validationResult 
          : `Invalid value for --${key}`;
        throw new Error(message);
      }
    }
  }

  return result as ResolvedOptions<T>;
}

/**
 * Generate help text from command definition
 */
export function generateHelp<T extends CommandOptions>(
  command: CommandDefinition<T>
): string {
  const lines: string[] = [];
  
  lines.push(`${command.name} - ${command.description}\n`);
  lines.push('OPTIONS:');
  
  for (const [key, optDef] of Object.entries(command.options)) {
    const flags = [`--${key}`];
    if (optDef.alias) {
      flags.unshift(`-${optDef.alias}`);
    }
    
    const required = optDef.required ? '[required]' : '[optional]';
    const defaultValue = optDef.default !== undefined ? `(default: ${optDef.default})` : '';
    const choices = optDef.type === 'enum' ? `(${optDef.choices?.join('|')})` : '';
    
    lines.push(`  ${flags.join(', ')} ${required} ${choices} ${defaultValue}`);
    if (optDef.description) {
      lines.push(`    ${optDef.description}`);
    }
  }
  
  if (command.examples && command.examples.length > 0) {
    lines.push('\nEXAMPLES:');
    for (const example of command.examples) {
      lines.push(`  ${example}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Execute a command with parsed arguments
 */
export async function executeCommand<T extends CommandOptions>(
  command: CommandDefinition<T>,
  args: string[]
): Promise<any> {
  const options = parseArgs(args, command.options);
  const context: CommandContext<T> = {
    options,
    rawArgs: args,
    env: process.env,
  };
  
  return await command.run(context);
}
