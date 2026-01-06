# Test bots

Test bots for the XMTP protocol that validate functionality, automate testing scenarios, and provide interactive agents for development.

## Quick reference

| Bot            | Purpose             | Key Features                            |
| -------------- | ------------------- | --------------------------------------- |
| **echo/**      | Echo bot            | Simple message echo with prefix         |
| **key-check/** | Key package checker | Check XMTP key package status, commands |

## Usage

```bash
# Run the echo bot
yarn bot echo --env dev

# Run the key-check bot
yarn bot key-check
```

## PM2 Management

### GM Bot

```bash
# Start GM bot
yarn start:gm:pm2

# Stop GM bot
yarn stop:gm:pm2

# Restart GM bot
yarn restart:gm:pm2

# View GM bot logs
yarn logs:gm:pm2
```

### Key-Check Bot

```bash
# Start key-check bot
yarn start:keycheck:pm2

# Stop key-check bot
yarn stop:keycheck:pm2

# Restart key-check bot
yarn restart:keycheck:pm2

# View key-check bot logs
yarn logs:keycheck:pm2
```

### Both Bots

```bash
# Start both bots
yarn start:pm2

# Stop both bots
yarn stop:pm2

# Restart both bots
yarn restart:pm2

# View logs for both
yarn logs:pm2
```
