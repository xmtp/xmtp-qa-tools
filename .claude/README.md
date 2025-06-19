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
claude "Same commands work with global installation"
```

Claude will understand your XMTP testing framework and can help with:

- Worker management and test setup
- XMTP client creation and configuration
- Database and encryption issues
- Log analysis and debugging
- Test patterns and best practices
