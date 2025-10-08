#!/usr/bin/env node
/**
 * AI Context Generator
 * 
 * Generates a comprehensive schema and documentation for AI agents
 * to understand and use CLI commands automatically
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { discoverCommands, generateSchema } from './framework/runner.js';
import { generateHelp } from './framework/command.js';

async function generateAIContext() {
  console.log('🤖 Generating AI context...\n');
  
  const commands = await discoverCommands();
  const schema = await generateSchema();
  
  // Generate comprehensive AI context
  const context = {
    framework: {
      name: 'XMTP CLI Framework',
      description: 'A React-like declarative CLI framework for AI-discoverable commands',
      version: '1.0.0',
    },
    
    usage: {
      pattern: 'yarn cli <command> [options]',
      help: 'yarn cli --help',
      commandHelp: 'yarn cli <command> --help',
    },
    
    schema,
    
    commands: {} as Record<string, any>,
  };
  
  // Generate detailed help for each command
  for (const [name, command] of commands) {
    context.commands[name] = {
      help: generateHelp(command),
      metadata: {
        name: command.name,
        description: command.description,
        examples: command.examples,
      },
      parameters: {} as Record<string, any>,
    };
    
    // Add detailed parameter info
    for (const [optName, optDef] of Object.entries(command.options)) {
      context.commands[name].parameters[optName] = {
        type: optDef.type,
        description: optDef.description,
        required: optDef.required || false,
        default: optDef.default,
        choices: optDef.choices,
        alias: optDef.alias,
      };
    }
  }
  
  // Write JSON schema
  const schemaPath = join(process.cwd(), 'cli', 'ai-schema.json');
  await writeFile(schemaPath, JSON.stringify(schema, null, 2));
  console.log(`✅ Generated JSON schema: ${schemaPath}`);
  
  // Write full context
  const contextPath = join(process.cwd(), 'cli', 'ai-context.json');
  await writeFile(contextPath, JSON.stringify(context, null, 2));
  console.log(`✅ Generated AI context: ${contextPath}`);
  
  // Generate markdown documentation
  let markdown = `# XMTP CLI Framework - AI Reference\n\n`;
  markdown += `Auto-generated documentation for AI agents\n\n`;
  markdown += `## Quick Start\n\n`;
  markdown += `\`\`\`bash\n`;
  markdown += `yarn cli <command> [options]\n`;
  markdown += `yarn cli --help  # List all commands\n`;
  markdown += `yarn cli <command> --help  # Command-specific help\n`;
  markdown += `\`\`\`\n\n`;
  markdown += `## Available Commands\n\n`;
  
  for (const [name, command] of commands) {
    markdown += `### ${name}\n\n`;
    markdown += `${command.description}\n\n`;
    markdown += `**Options:**\n\n`;
    
    for (const [optName, optDef] of Object.entries(command.options)) {
      const req = optDef.required ? '**required**' : '*optional*';
      const def = optDef.default !== undefined ? ` (default: \`${optDef.default}\`)` : '';
      const choices = optDef.type === 'enum' ? ` - one of: \`${optDef.choices?.join('|')}\`` : '';
      
      markdown += `- \`--${optName}\` (${optDef.type}) ${req}${def}${choices}\n`;
      if (optDef.description) {
        markdown += `  - ${optDef.description}\n`;
      }
    }
    
    if (command.examples && command.examples.length > 0) {
      markdown += `\n**Examples:**\n\n`;
      for (const example of command.examples) {
        markdown += `\`\`\`bash\n${example}\n\`\`\`\n\n`;
      }
    }
    
    markdown += `\n---\n\n`;
  }
  
  const docsPath = join(process.cwd(), 'cli', 'AI_REFERENCE.md');
  await writeFile(docsPath, markdown);
  console.log(`✅ Generated documentation: ${docsPath}`);
  
  console.log(`\n🎉 AI context generation complete!`);
  console.log(`\nAI agents can now:`);
  console.log(`  1. Read ai-schema.json for command structure`);
  console.log(`  2. Read ai-context.json for full context`);
  console.log(`  3. Read AI_REFERENCE.md for human-readable docs`);
  console.log(`  4. Execute: yarn cli <command> [options]`);
}

generateAIContext().catch(console.error);
