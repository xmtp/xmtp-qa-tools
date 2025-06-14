# Claude Code Configuration for XMTP QA Tools

This directory contains Claude Code configuration specific to this XMTP repository.

## Files

- `context.md` - Repository context and patterns for Claude to understand
- `mcp-config.json` - MCP server configuration for file access and tools

## Usage

When you run `claude` in this repository, it will automatically:

- Load the XMTP repository context
- Understand your testing patterns and worker framework
- Know about common XMTP error patterns
- Have access to relevant directories and tools

## Examples

```bash
# Start Claude with repo context
npx @anthropic-ai/claude-code

# Ask about your codebase
npx @anthropic-ai/claude-code "How do I create a new test using the worker framework?"

# Debug issues
npx @anthropic-ai/claude-code "Why is my XMTP test failing with a database error?"

# Analyze logs
npx @anthropic-ai/claude-code "Check the latest test logs and tell me what failed"

# Get help with patterns
npx @anthropic-ai/claude-code "Show me the correct pattern for creating XMTP clients"

# Use the globally installed version (if available)
claude "Same commands work with global installation"
```

Claude will understand your XMTP testing framework and can help with:

- Worker management and test setup
- XMTP client creation and configuration
- Database and encryption issues
- Log analysis and debugging
- Test patterns and best practices
