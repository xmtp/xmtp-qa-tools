# XMTP CLI Framework

> A React-like declarative framework for building AI-discoverable CLI commands

## The Problem

Traditional CLIs require:
- ❌ Manual argument parsing (50+ lines per command)
- ❌ Manual help text generation and maintenance
- ❌ Manual registration in package.json
- ❌ AI agents need to read implementation details
- ❌ Repetitive boilerplate across commands

## The Solution

**CLI Components** - Self-describing, composable, auto-discoverable command definitions:

```typescript
export default defineCommand({
  name: 'groups',
  description: 'Create and manage XMTP groups',
  
  options: {
    operation: option.enum(['dm', 'group', 'update']).required(),
    env: option.enum(['local', 'dev', 'production']).default('production'),
    members: option.number().default(5).min(2),
  },
  
  async run({ options }) {
    // Just your logic - no boilerplate!
    return { success: true, data: {} };
  }
});
```

## Key Features

### 🤖 AI-First Design

- **Auto-discovery**: AI scans `commands/` folder, knows all commands instantly
- **Self-documenting**: Commands generate their own help text and JSON schema
- **Type-safe**: Full TypeScript support with inference
- **Zero registration**: Just drop a file in `commands/`, it's available

### ⚡ Developer Experience

- **Fluent API**: Chain option builders like React hooks
- **Validation**: Built-in type checking and custom validators
- **Examples**: Inline examples in command definitions
- **Error handling**: Automatic error messages

### 🔄 React-Like Patterns

```typescript
// Option builders (like React hooks)
option.string().default('value').validate(...)
option.number().min(0).max(100)
option.enum(['a', 'b', 'c']).required()

// Composition
const baseOptions = { env: option.enum(['local', 'dev']) };
const extendedOptions = { ...baseOptions, newOption: option.string() };
```

## Quick Start

### 1. Create a Command

Create `cli/commands/mycommand.command.ts`:

```typescript
import { defineCommand, option } from '../framework/index.js';

export default defineCommand({
  name: 'mycommand',
  description: 'My awesome command',
  
  options: {
    target: option.string().description('Target value').required(),
    count: option.number().default(1).min(1),
    env: option.enum(['dev', 'prod']).default('dev'),
  },
  
  examples: [
    'yarn cli mycommand --target user123 --count 5',
    'yarn cli mycommand --target user456 --env prod',
  ],
  
  async run({ options }) {
    console.log(`Processing ${options.target} (count: ${options.count})`);
    return { 
      success: true, 
      data: { target: options.target, count: options.count } 
    };
  },
});
```

### 2. Run It

```bash
# Auto-discovered instantly!
yarn cli mycommand --target user123 --count 5

# Get help
yarn cli mycommand --help

# List all commands
yarn cli --help
```

### 3. AI Can Use It

```bash
# Generate AI context
yarn cli:gen-ai-context

# AI reads ai-schema.json and knows:
# - All available commands
# - All parameters and types
# - Examples and validation rules
# - How to execute: yarn cli <command> [options]
```

## Option Builders

### String Options

```typescript
option.string()
  .description('A string value')
  .default('default value')
  .required()
  .alias('s')  // -s shorthand
  .validate(v => v.length > 0 || 'Must not be empty')
```

### Number Options

```typescript
option.number()
  .description('A number value')
  .default(42)
  .min(0)
  .max(100)
  .validate(v => v % 2 === 0 || 'Must be even')
```

### Boolean Options

```typescript
option.boolean()
  .description('A flag')
  .default(false)
```

### Enum Options

```typescript
option.enum(['local', 'dev', 'production'] as const)
  .description('Environment')
  .default('dev' as const)
  .required()
```

### Array Options

```typescript
option.array()
  .description('List of values')
  .separator(',')  // Split by comma
```

## Advanced Patterns

### Custom Validation

```typescript
options: {
  email: option.string()
    .validate(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email'),
  
  port: option.number()
    .validate(v => {
      if (v < 1024) return 'Port must be >= 1024';
      if (v > 65535) return 'Port must be <= 65535';
      return true;
    }),
}
```

### Conditional Options

```typescript
async run({ options }) {
  if (options.operation === 'update' && !options.groupId) {
    throw new Error('--groupId required for update operation');
  }
}
```

### Structured Output

```typescript
async run({ options }) {
  const result = await doWork(options);
  
  // Return structured data for AI consumption
  return {
    success: true,
    data: {
      id: result.id,
      status: result.status,
      url: `https://example.com/${result.id}`,
    },
    message: 'Operation completed successfully',
  };
}
```

## AI Integration

### Generate Context

```bash
yarn cli:gen-ai-context
```

This generates:
1. **`ai-schema.json`** - JSON schema of all commands
2. **`ai-context.json`** - Full context with examples
3. **`AI_REFERENCE.md`** - Human-readable docs

### AI Workflow

1. AI reads `ai-schema.json` to discover commands
2. AI sees parameter types, descriptions, examples
3. AI executes: `yarn cli <command> [options]`
4. AI parses structured JSON output
5. No code reading required! ✨

## Migration Guide

### Before (Old Pattern)

```typescript
// 150+ lines of boilerplate
function parseArgs() { /* ... */ }
function showHelp() { /* ... */ }
function validateOptions() { /* ... */ }

async function main() {
  const args = process.argv.slice(2);
  // Manual parsing...
}
```

### After (New Pattern)

```typescript
// ~30 lines, all business logic
export default defineCommand({
  name: 'command',
  description: 'Does something',
  options: { /* declarative */ },
  async run({ options }) { /* just logic */ }
});
```

### Steps to Migrate

1. Create `commands/yourcommand.command.ts`
2. Copy business logic from old file
3. Define options declaratively
4. Delete old command file
5. Test with `yarn cli yourcommand --help`

## Architecture

```
cli/
├── framework/              # Core framework
│   ├── types.ts           # Type definitions
│   ├── option-builders.ts # Fluent builders
│   ├── command.ts         # Command utilities
│   ├── runner.ts          # Auto-discovery
│   └── cli.ts             # Entry point
│
├── commands/              # Command definitions
│   ├── groups.command.ts  # Example command
│   └── *.command.ts       # Auto-discovered
│
├── ai-schema.json        # Generated AI schema
├── ai-context.json       # Generated AI context
└── AI_REFERENCE.md       # Generated docs
```

## Comparison to React

| React | CLI Framework |
|-------|---------------|
| `useState()` | `option.string()` |
| `useEffect()` | `async run()` |
| Components | Commands |
| Props | Options |
| JSX | Fluent API |
| Auto-discovery | Auto-discovery |
| Type inference | Type inference |

## Benefits

### For Developers
- ✅ Write 70% less code
- ✅ Type-safe parameters
- ✅ Auto-generated help text
- ✅ Built-in validation
- ✅ Consistent patterns

### For AI Agents
- ✅ Zero setup - instant discovery
- ✅ Self-documenting commands
- ✅ Structured input/output
- ✅ No code reading needed
- ✅ Predictable execution

## Examples

See `cli/commands/groups.command.ts` for a complete real-world example.

## Contributing

1. Add commands to `cli/commands/`
2. Follow the naming pattern: `*.command.ts`
3. Export default `defineCommand(...)`
4. Run `yarn cli:gen-ai-context` to update schemas

## License

Part of XMTP QA Tools
