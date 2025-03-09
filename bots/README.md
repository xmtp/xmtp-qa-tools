# 🤖 XMTP Test Bots

Internal testing toolkit for XMTP protocol development.

## All bots

### 👋 GM Bot

```bash
Address: 0x9a1C0F4b648C6D8783b259db194be44c8310a943 (dev)
Function: Replies "gm" to any message
Use case: Quick connectivity verification
```

See more in [gm/README.md](/bots/gm/README.md)

### 🧪 Test Bot

```bash
Address: 0x5348Ca464c55856AcfEE5F4490d12BF51D24B01F (dev)
Function: Multi-persona simulation environment
Use case: Complex messaging scenario testing
```

See more in [test/README.md](/bots/test/README.md)

#### Command Reference

| Command                | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `gm`                   | Returns gm to your message                                   |
| `/create [5]`          | Creates a test group with simulated users and conversation   |
| `/rename [name]`       | Rename the current group                                     |
| `/add [name]`          | Add the name of a persona to the group                       |
| `/remove [name]`       | Remove the name of a persona from the group                  |
| `/groups`              | List all active groups                                       |
| `/members`             | List all members in the current group                        |
| `/broadcast [message]` | Broadcast a message to all participants in the current group |
| `/leave`               | Leave the current group                                      |
| `/info`                | Get info about the current group                             |
| `/workers`             | List all available workers                                   |

## Quick Setup

```bash
# Dependencies
yarn install

# Launch test environment
yarn bot

# Config (.env)
LOGGING_LEVEL="off"    # Verbosity control
XMTP_ENV="dev"         # Network selection
```

## Implementation Notes

- Test bot deploys 20 simulated personas by default
- Persona keys stored in `.data/` for persistence
- `random`-prefixed personas use ephemeral in-memory keys
- All bots run on dev network unless configured otherwise
