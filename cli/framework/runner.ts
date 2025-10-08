/**
 * Auto-Discovery CLI Runner
 * 
 * Automatically discovers and executes commands from the commands/ directory
 */

import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CommandDefinition } from './types.js';
import { executeCommand, generateHelp } from './command.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Discover all commands in the commands directory
 */
export async function discoverCommands(): Promise<Map<string, CommandDefinition>> {
  const commandsDir = join(__dirname, '..', 'commands');
  const commands = new Map<string, CommandDefinition>();
  
  try {
    const files = await readdir(commandsDir);
    
    for (const file of files) {
      if (file.endsWith('.command.ts') || file.endsWith('.command.js')) {
        const modulePath = join(commandsDir, file);
        const module = await import(modulePath);
        const command = module.default as CommandDefinition;
        
        if (command && command.name) {
          commands.set(command.name, command);
        }
      }
    }
  } catch (error) {
    console.error('Failed to discover commands:', error);
  }
  
  return commands;
}

/**
 * Get a specific command by name
 */
export async function getCommand(name: string): Promise<CommandDefinition | undefined> {
  const commands = await discoverCommands();
  return commands.get(name);
}

/**
 * List all available commands
 */
export async function listCommands(): Promise<string[]> {
  const commands = await discoverCommands();
  return Array.from(commands.keys());
}

/**
 * Main CLI runner - auto-discovers and executes commands
 */
export async function runCLI(args: string[] = process.argv.slice(2)): Promise<void> {
  // Handle global help
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    await showGlobalHelp();
    return;
  }
  
  // First arg is the command name
  const commandName = args[0];
  const commandArgs = args.slice(1);
  
  // Handle command-specific help
  if (commandArgs.includes('--help') || commandArgs.includes('-h')) {
    const command = await getCommand(commandName);
    if (command) {
      console.log(generateHelp(command));
      return;
    }
  }
  
  // Execute command
  const command = await getCommand(commandName);
  
  if (!command) {
    console.error(`Unknown command: ${commandName}`);
    console.error(`Run 'cli --help' to see available commands`);
    process.exit(1);
  }
  
  try {
    const result = await executeCommand(command, commandArgs);
    
    // Pretty print result
    if (result) {
      console.log('\n📊 Result:');
      console.log(JSON.stringify(result, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Command failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Show global help with all available commands
 */
async function showGlobalHelp(): Promise<void> {
  const commands = await discoverCommands();
  
  console.log(`
XMTP CLI Framework - Auto-discovered commands

USAGE:
  yarn cli <command> [options]

AVAILABLE COMMANDS:
`);
  
  for (const [name, command] of commands) {
    console.log(`  ${name.padEnd(20)} ${command.description}`);
  }
  
  console.log(`
GLOBAL OPTIONS:
  -h, --help            Show this help or command-specific help

EXAMPLES:
  yarn cli --help
  yarn cli groups --help
  yarn cli groups --operation group --members 10

For more information on a specific command:
  yarn cli <command> --help
`);
}

/**
 * Generate OpenAPI-style schema for AI discovery
 */
export async function generateSchema(): Promise<any> {
  const commands = await discoverCommands();
  const schema: any = {
    version: '1.0.0',
    commands: {},
  };
  
  for (const [name, command] of commands) {
    schema.commands[name] = {
      name: command.name,
      description: command.description,
      parameters: {},
      examples: command.examples || [],
    };
    
    for (const [optName, optDef] of Object.entries(command.options)) {
      schema.commands[name].parameters[optName] = {
        type: optDef.type,
        description: optDef.description,
        required: optDef.required || false,
        default: optDef.default,
        choices: optDef.choices,
      };
    }
  }
  
  return schema;
}
