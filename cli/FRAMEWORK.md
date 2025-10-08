# CLI Framework: The React of CLIs for AI

## Vision

**Traditional CLIs are like jQuery** - imperative, verbose, hard for AI to understand.

**This framework is like React** - declarative, composable, AI-first.

## The Core Insight

AI agents don't need to read code. They need to read **schemas**.

Just like React components are self-describing with PropTypes/TypeScript, CLI commands should be:
1. **Self-describing** - The definition IS the documentation
2. **Auto-discoverable** - Filesystem = API surface
3. **Type-safe** - Compiler enforces correctness
4. **Instantly executable** - No build, no setup

## What Makes This "React-like"?

### 1. Declarative API

**React:**
```jsx
function Button({ onClick, children }) {
  return <button onClick={onClick}>{children}</button>
}
```

**CLI Framework:**
```typescript
export default defineCommand({
  name: 'send',
  options: {
    target: option.string().required(),
    message: option.string().default('Hello'),
  },
  async run({ options }) {
    await send(options.target, options.message);
  }
})
```

### 2. Composable Primitives

**React Hooks:**
```javascript
const [state, setState] = useState()
const value = useContext(Context)
const ref = useRef()
```

**CLI Options:**
```typescript
option.string()    // Primitive type
option.number().min(0).max(100)  // With constraints
option.enum(['a', 'b']).required()  // With choices
```

### 3. Auto-Discovery

**React:**
- Components are auto-discovered by the bundler
- No manual registration needed
- Just import and use

**CLI Framework:**
- Commands are auto-discovered from filesystem
- No package.json registration
- Just create `*.command.ts` file

### 4. Type Inference

**React (TypeScript):**
```typescript
interface Props { name: string; age: number }
function Greeting({ name, age }: Props) { }
// TypeScript knows prop types
```

**CLI Framework:**
```typescript
const command = defineCommand({
  options: {
    name: option.string().required(),
    age: option.number().default(0),
  },
  async run({ options }) {
    options.name  // TypeScript knows: string
    options.age   // TypeScript knows: number
  }
})
```

### 5. Developer Experience

**React:**
- Write once, reuse everywhere
- Hot reload during development
- Great error messages
- Huge ecosystem

**CLI Framework:**
- Write once, AI can execute
- Auto-discovery (no restarts)
- Automatic validation errors
- Extensible architecture

## The AI Advantage

### Traditional CLI (jQuery-style)
```typescript
// AI needs to:
// 1. Read 200 lines of parsing code
// 2. Understand business logic
// 3. Figure out valid arguments
// 4. Guess output format

function main() {
  const args = process.argv.slice(2);
  let target = null;
  let count = 5;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target') {
      target = args[i + 1];
      i++;
    }
    // ... 50 more lines
  }
  
  if (!target) {
    console.error('Target required');
    process.exit(1);
  }
  
  // ... business logic mixed with parsing
}
```

**What AI sees:** 😵 200 lines of imperative code to parse

### New Framework (React-style)
```typescript
export default defineCommand({
  name: 'send',
  description: 'Send messages to target',
  options: {
    target: option.string()
      .description('Target address')
      .required(),
    count: option.number()
      .default(5)
      .min(1),
  },
  examples: [
    'yarn cli send --target 0x123 --count 10'
  ],
  async run({ options }) {
    return await sendMessages(options.target, options.count);
  }
})
```

**What AI sees:** 📋 JSON schema
```json
{
  "name": "send",
  "description": "Send messages to target",
  "parameters": {
    "target": { "type": "string", "required": true },
    "count": { "type": "number", "default": 5, "min": 1 }
  },
  "examples": ["yarn cli send --target 0x123 --count 10"]
}
```

**AI workflow:**
1. Reads `ai-schema.json` → knows all commands instantly
2. Sees types, defaults, validation → knows how to use it
3. Executes `yarn cli send --target 0x123` → gets structured output
4. Never reads implementation code!

## Key Innovations

### 1. Zero Registration
```bash
# Old way: Add to package.json manually
"scripts": {
  "my-command": "tsx cli/my-command.ts"
}

# New way: Just create the file
cli/commands/my-command.command.ts
# Auto-discovered instantly!
```

### 2. Self-Documenting
```typescript
// Help text is auto-generated from definition
// No need to maintain separate documentation
// Changes to options = automatic doc updates

yarn cli my-command --help
// Shows generated help from schema
```

### 3. AI Schema Generation
```bash
yarn cli:gen-ai-context

# Generates:
# - ai-schema.json (minimal, for AI)
# - ai-context.json (full context)
# - AI_REFERENCE.md (human docs)
```

### 4. Structured Output
```typescript
async run({ options }) {
  // Return structured data
  return {
    success: true,
    data: { id: '123', status: 'done' },
    message: 'Completed successfully'
  };
}

// AI parses JSON output easily
// No regex or string parsing needed
```

## Architecture Patterns

### Command Composition
```typescript
// Shared options
const baseOptions = {
  env: option.enum(['local', 'dev', 'production']).default('dev'),
  verbose: option.boolean().default(false),
};

// Compose commands
export default defineCommand({
  name: 'deploy',
  options: {
    ...baseOptions,
    target: option.string().required(),
  },
  async run({ options }) { }
});
```

### Custom Hooks (Future)
```typescript
// Like React hooks, but for CLI
function useClient(env: string) {
  return createClient({ env });
}

function useAuth() {
  return getCredentials();
}

// Use in commands
async run({ options }) {
  const client = useClient(options.env);
  const auth = useAuth();
  // ...
}
```

### Middleware (Future)
```typescript
defineCommand({
  name: 'send',
  middleware: [
    requireAuth,
    validateNetwork,
    logExecution,
  ],
  async run({ options }) { }
});
```

## Comparison Table

| Feature | Traditional CLI | CLI Framework | React |
|---------|----------------|---------------|-------|
| **Definition** | Imperative | Declarative | Declarative |
| **Discovery** | Manual (package.json) | Auto (filesystem) | Auto (bundler) |
| **Documentation** | Manual (separate files) | Auto (from schema) | Auto (PropTypes/TS) |
| **Validation** | Manual parsing | Built-in | PropTypes |
| **Type Safety** | Weak | Strong (TypeScript) | Strong (TypeScript) |
| **AI Friendly** | ❌ Must read code | ✅ Read schema | ✅ Component tree |
| **Boilerplate** | 100+ lines | 20-30 lines | Minimal |
| **Reusability** | Copy-paste | Composition | Composition |

## Next Steps

### Immediate
- [x] Core framework (types, builders, runner)
- [x] Example command (groups)
- [x] AI schema generation
- [x] Documentation

### Near Future
- [ ] Migrate more commands (test, bot, send, etc.)
- [ ] Add command hooks (useClient, useAuth)
- [ ] Interactive mode (like React DevTools)
- [ ] Command middleware system

### Long Term
- [ ] Plugin system
- [ ] Command marketplace
- [ ] Visual command builder
- [ ] Real-time AI collaboration

## Philosophy

**"CLIs should be as easy to use for AI as React components are for developers"**

- Components self-describe their props → Commands self-describe their options
- React auto-discovers components → Framework auto-discovers commands
- TypeScript enforces prop types → Framework enforces option types
- React composable → Commands composable
- JSX declarative → Options declarative

The goal: **Zero context switching for AI**. Just like you don't read React source to use a component, AI shouldn't read CLI source to execute commands.

## Impact

### For Developers
- Write 70% less code
- Zero boilerplate
- Type-safe by default
- Consistent patterns

### For AI Agents
- **Instant understanding** - Read schema, not code
- **Instant execution** - No setup, no interpretation
- **Predictable output** - Structured JSON
- **Self-service** - Discover + execute autonomously

### For the Ecosystem
- **Standardization** - Common patterns across tools
- **Interoperability** - AI can use any framework command
- **Innovation** - Focus on logic, not parsing
- **Quality** - Built-in validation and error handling

---

**This is the React revolution, but for CLIs and AI.** 🚀
