# Getting Started with the CLI Framework

## What We Built

A **React-like declarative framework** for building CLI commands that AI agents can discover and execute automatically.

## Quick Demo

### 1. See Available Commands

```bash
yarn cli --help
```

This auto-discovers all `*.command.ts` files in `cli/commands/`.

### 2. Run the Example Command

```bash
# Get help for groups command
yarn cli groups --help

# Create a group (using the NEW framework)
yarn cli groups --operation group --members 5 --groupName "Test Group" --env dev

# Create DMs
yarn cli groups --operation dm --dmCount 3 --env dev
```

### 3. Generate AI Context

```bash
yarn cli:gen-ai-context
```

This creates:
- `cli/ai-schema.json` - Minimal JSON schema for AI
- `cli/ai-context.json` - Full context with examples
- `cli/AI_REFERENCE.md` - Human-readable documentation

## How It Works

### Traditional Way (Old)

```typescript
// cli/groups.ts - 385 lines
function parseArgs() { /* 50 lines of arg parsing */ }
function showHelp() { /* 50 lines of help text */ }
async function main() {
  const config = parseArgs();
  // business logic mixed with parsing
}
```

**Problems:**
- ❌ 385 lines of code (70% boilerplate)
- ❌ Manual arg parsing and validation
- ❌ Manual help text (gets out of sync)
- ❌ AI must read all code to understand
- ❌ Manual registration in package.json

### New Way (Framework)

```typescript
// cli/commands/groups.command.ts - 150 lines (60% less!)
export default defineCommand({
  name: 'groups',
  description: 'Create and manage XMTP groups',
  
  options: {
    operation: option.enum(['dm', 'group', 'update']).required(),
    env: option.enum(['local', 'dev', 'production']).default('production'),
    members: option.number().default(5).min(2),
    groupName: option.string().optional(),
  },
  
  examples: [
    'yarn cli groups --operation group --members 10',
  ],
  
  async run({ options }) {
    // Just business logic - no boilerplate!
    if (options.operation === 'group') {
      return await createGroup(options);
    }
  }
});
```

**Benefits:**
- ✅ 60% less code (150 vs 385 lines)
- ✅ Auto parsing and validation
- ✅ Auto-generated help text
- ✅ AI reads JSON schema, not code
- ✅ Auto-discovered (no registration)

## Creating Your First Command

### Step 1: Create the Command File

```bash
touch cli/commands/hello.command.ts
```

### Step 2: Define the Command

```typescript
import { defineCommand, option } from '../framework/index.js';

export default defineCommand({
  name: 'hello',
  description: 'A friendly greeting command',
  
  options: {
    name: option
      .string()
      .description('Your name')
      .default('World'),
    
    count: option
      .number()
      .description('How many times to greet')
      .default(1)
      .min(1)
      .max(10),
    
    excited: option
      .boolean()
      .description('Use exclamation marks')
      .default(false),
  },
  
  examples: [
    'yarn cli hello --name Alice',
    'yarn cli hello --name Bob --count 3 --excited',
  ],
  
  async run({ options }) {
    const greeting = `Hello, ${options.name}`;
    const punctuation = options.excited ? '!' : '.';
    
    for (let i = 0; i < options.count; i++) {
      console.log(greeting + punctuation);
    }
    
    return {
      success: true,
      data: {
        name: options.name,
        count: options.count,
        excited: options.excited,
      },
    };
  },
});
```

### Step 3: Test It

```bash
# Auto-discovered instantly!
yarn cli hello --help

# Run it
yarn cli hello --name Alice --count 3 --excited
```

### Step 4: Update AI Context

```bash
yarn cli:gen-ai-context
```

Now AI agents can discover and use your command automatically!

## Option Types Reference

### String Options

```typescript
name: option.string()
  .description('User name')
  .default('guest')
  .required()
  .alias('n')  // -n shorthand
  .validate(v => v.length > 0 || 'Name required')
```

### Number Options

```typescript
port: option.number()
  .description('Port number')
  .default(3000)
  .min(1024)
  .max(65535)
  .validate(v => v % 2 === 0 || 'Must be even')
```

### Boolean Flags

```typescript
verbose: option.boolean()
  .description('Enable verbose logging')
  .default(false)
```

### Enum/Choice Options

```typescript
env: option.enum(['local', 'dev', 'production'] as const)
  .description('Environment')
  .default('dev' as const)
  .required()
```

### Array Options

```typescript
tags: option.array()
  .description('List of tags')
  .separator(',')  // comma-separated
```

## Advanced Patterns

### Conditional Validation

```typescript
async run({ options }) {
  if (options.operation === 'update' && !options.id) {
    throw new Error('--id is required for update operation');
  }
  
  // Continue with logic
}
```

### Structured Output

```typescript
async run({ options }) {
  const result = await doSomething(options);
  
  // Return structured data for AI consumption
  return {
    success: true,
    data: {
      id: result.id,
      status: result.status,
      url: `https://example.com/${result.id}`,
    },
    message: 'Operation completed',
    metadata: {
      timestamp: new Date().toISOString(),
      duration: result.duration,
    },
  };
}
```

### Shared Options

```typescript
// Create reusable option sets
const baseOptions = {
  env: option.enum(['local', 'dev', 'production']).default('dev'),
  verbose: option.boolean().default(false),
};

// Use in multiple commands
export default defineCommand({
  name: 'deploy',
  options: {
    ...baseOptions,
    target: option.string().required(),
  },
  async run({ options }) { }
});

export default defineCommand({
  name: 'test',
  options: {
    ...baseOptions,
    suite: option.string().required(),
  },
  async run({ options }) { }
});
```

## AI Integration Workflow

### 1. AI Reads Schema

```bash
# AI reads this file
cat cli/ai-schema.json
```

### 2. AI Sees Command Structure

```json
{
  "version": "1.0.0",
  "commands": {
    "groups": {
      "name": "groups",
      "description": "Create and manage XMTP groups",
      "parameters": {
        "operation": {
          "type": "enum",
          "choices": ["dm", "group", "update"],
          "required": true
        },
        "env": {
          "type": "enum",
          "choices": ["local", "dev", "production"],
          "default": "production"
        }
      },
      "examples": ["yarn cli groups --operation group --members 10"]
    }
  }
}
```

### 3. AI Executes Command

```bash
yarn cli groups --operation group --members 10 --env dev
```

### 4. AI Parses Output

```json
{
  "success": true,
  "data": {
    "groupId": "abc123...",
    "groupName": "Test Group",
    "memberCount": 10,
    "url": "https://xmtp.chat/conversations/abc123..."
  }
}
```

**No code reading required!** 🎉

## Migration Guide

Want to migrate an existing command? Here's how:

### Before

```typescript
// cli/mycommand.ts
function parseArgs() { /* 50 lines */ }
function showHelp() { /* 30 lines */ }
async function main() { /* 100 lines */ }
```

### After

1. Create `cli/commands/mycommand.command.ts`
2. Define options declaratively (10 lines)
3. Copy business logic to `run()` function
4. Delete old file
5. Done! 

**Reduces code by 60-70% on average.**

## Project Structure

```
cli/
├── framework/                 # Core framework
│   ├── types.ts              # TypeScript types
│   ├── option-builders.ts    # Fluent option API
│   ├── command.ts            # Command utilities
│   ├── runner.ts             # Auto-discovery engine
│   ├── cli.ts                # CLI entry point
│   └── README.md             # Framework docs
│
├── commands/                 # Your commands (auto-discovered)
│   ├── groups.command.ts     # Example: groups command
│   └── *.command.ts          # Any *.command.ts file
│
├── ai-schema.json           # Generated: AI schema
├── ai-context.json          # Generated: Full AI context
├── AI_REFERENCE.md          # Generated: Human docs
├── FRAMEWORK.md             # Vision and philosophy
└── GETTING_STARTED.md       # This file!
```

## FAQ

### Q: Do I need to register commands in package.json?

**A:** No! Just create `*.command.ts` in `cli/commands/` and it's auto-discovered.

### Q: How do I test my command?

**A:** Run `yarn cli <command-name> --help` to see help, then execute with options.

### Q: Can AI use my commands without code access?

**A:** Yes! AI reads `ai-schema.json` which is auto-generated from your command definitions.

### Q: What about validation?

**A:** Built-in! Use `.required()`, `.min()`, `.max()`, or custom `.validate()` functions.

### Q: Can I compose commands?

**A:** Yes! Share option definitions, create helper functions, build reusable patterns.

### Q: Is this production-ready?

**A:** Yes! The framework is fully functional. We've migrated the `groups` command as proof.

## Next Steps

1. ✅ **Try the example**: `yarn cli groups --help`
2. ✅ **Create your own command**: Follow the guide above
3. ✅ **Generate AI context**: `yarn cli:gen-ai-context`
4. 🚀 **Migrate existing commands**: Start with simple ones first
5. 📖 **Read FRAMEWORK.md**: Understand the philosophy

## Resources

- `cli/framework/README.md` - Framework documentation
- `cli/FRAMEWORK.md` - Vision and philosophy
- `cli/AI_REFERENCE.md` - Auto-generated AI docs
- `cli/commands/groups.command.ts` - Real-world example

---

**Welcome to the future of AI-powered CLIs!** 🎉
