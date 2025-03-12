# 🤖 XMTP Test Bots

Internal testing toolkit for XMTP protocol development.

## All bots

### 👋 GM Bot

```bash
Address: 0x9a1C0F4b648C6D8783b259db194be44c8310a943 (dev)
Function: Replies "gm" to any message
Use case: Quick connectivity verification
```

```bash
# Launch test environment
yarn gm

# Config (.env)
LOGGING_LEVEL="off"    # Verbosity control
XMTP_ENV="dev"         # Network selection
```

See more in [gm/README.md](/bots/gm/README.md)

### 🧪 Test Bot

```bash
Address: 0x5348Ca464c55856AcfEE5F4490d12BF51D24B01F (dev)
Function: Multi-persona simulation environment
Use case: Complex messaging scenario testing
```

```bash
# Dependencies
yarn install

# Launch test environment
yarn bot

# Config (.env)
LOGGING_LEVEL="off"    # Verbosity control
XMTP_ENV="dev"         # Network selection
```

See more in [test/README.md](/bots/test/README.md)

#### Implementation Notes

- Test bot deploys 20 simulated personas by default
- Persona keys stored in `.data/` for persistence
- `random`-prefixed personas use ephemeral in-memory keys
- All bots run on dev network unless configured otherwise
