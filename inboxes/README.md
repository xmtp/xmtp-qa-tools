# XMTP Test Data Generation

This directory contains utilities for generating XMTP test data, including user accounts and installations with populated databases.

## Files

- `gen.ts` - Main generation script
- `gen.sh` - Shell wrapper for generation commands
- `utils.ts` - Utility functions
- `*.json` - Generated user account data files

## Basic Account Generation

Generate basic user accounts:

```bash
# Generate 200 accounts (default)
yarn gen

# Generate specific number of accounts
yarn gen --count 100

# Generate for specific environments
yarn gen --envs local,dev --count 50

# Generate with multiple installations per account
yarn gen --installations 5 --count 100
```

## Installation Generation with Content

**NEW:** Generate installations with pre-populated databases containing groups and conversations:

```bash
# Generate 10 installations with default content (200 groups, 200 conversations each)
yarn gen:installations

# Generate with custom parameters
yarn gen --create-installations 10 --groups-per-installation 200 --conversations-per-group 200

# Generate for specific environment
yarn gen --create-installations 5 --env dev

# Debug mode
yarn gen --create-installations 10 --debug
```

### Installation Features

- **10 installations** (configurable)
- **200 groups per installation** (configurable)
- **200 conversations per group** (configurable)
- **Database files saved to `./installations/`** (tracked in git)
- **JSON metadata files** with installation details
- **Multi-member groups** (2-5 random members per group)
- **Realistic conversation content** with timestamps

## Output Structure

### Basic Account Generation
```
inboxes/
├── 2.json         # 2 installations per account
├── 5.json         # 5 installations per account
├── 10.json        # 10 installations per account
├── 15.json        # 15 installations per account
├── 20.json        # 20 installations per account
├── 25.json        # 25 installations per account
└── 30.json        # 30 installations per account
```

### Installation Generation
```
installations/
├── installation-1-local/     # DB files for installation 1
├── installation-2-local/     # DB files for installation 2
├── ...
├── installation-10-local/    # DB files for installation 10
└── installations-local.json  # Metadata for all installations
```

## Requirements

- Existing user accounts (run `yarn gen --count 100` first)
- Valid XMTP environment configuration
- Sufficient disk space for database files

## Configuration

Environment variables (`.env`):
```bash
WALLET_KEY=0x...
ENCRYPTION_KEY=...
XMTP_ENV=local
```

## Git Integration

- Basic account JSON files: **Tracked in git**
- Installation database files: **Tracked in git** (not ignored)
- Installation metadata JSON: **Tracked in git**
- Log files: **Ignored**

## Usage Examples

### Quick Start
```bash
# 1. Generate base accounts
yarn gen --count 100

# 2. Generate installations with content
yarn gen:installations

# 3. View results
ls -la installations/
```

### Custom Configuration
```bash
# Large installation set
yarn gen --create-installations 20 --groups-per-installation 500 --conversations-per-group 100

# Small test set
yarn gen --create-installations 3 --groups-per-installation 10 --conversations-per-group 5
```

### Environment-Specific
```bash
# Development environment
yarn gen --create-installations 10 --env dev

# Production environment  
yarn gen --create-installations 5 --env production
```

## Troubleshooting

- **"Not enough existing inboxes"**: Run `yarn gen --count 100` first
- **Import errors**: Ensure all dependencies are installed with `yarn install`
- **Environment errors**: Check `.env` file configuration
- **Database errors**: Ensure sufficient disk space and write permissions

## Performance Notes

- Each installation takes ~30-60 seconds to generate
- Database files can be several MB each
- Progress bars show real-time generation status
- Use `--debug` flag for detailed logging
