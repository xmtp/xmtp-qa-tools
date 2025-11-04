# Key-Check Bot

A configurable XMTP bot for testing key packages, group functionality, and UX demos.

## Features

- **Configurable Menu Display**: Control whether the menu is shown after each action
- Interactive key package validation
- Group management tools
- UX message type demos
- Load testing capabilities

## Configuration

### Auto-Show Menu After Actions

You can control whether the menu is automatically displayed after each action by modifying the `AUTO_SHOW_MENU_AFTER_ACTION` constant in `index.ts`:

```typescript
// Configuration for auto-showing menu after actions
// Set to false to disable automatic menu display after actions
const AUTO_SHOW_MENU_AFTER_ACTION = true; // or false
```

When `AUTO_SHOW_MENU_AFTER_ACTION` is:

- **`true`** (default): After each action completes, the bot will show the navigation menu with all available options
- **`false`**: After each action completes, the bot will only send a completion message without showing the menu

### Example Usage

1. **With menu display enabled** (default):

   ```
   User: /kc
   Bot: [Shows main menu]
   User: [Clicks "🔑 Key Packages" → "🔑 Check Mine"]
   Bot: [Shows key package results]
   Bot: [Shows navigation menu again]
   ```

2. **With menu display disabled**:
   ```
   User: /kc
   Bot: [Shows main menu]
   User: [Clicks "🔑 Key Packages" → "🔑 Check Mine"]
   Bot: [Shows key package results]
   Bot: "Your key package check completed!"
   ```

## Usage

Send any of these commands to interact with the bot:

- `/kc` - Show main menu
- `help` - Show main menu
- `menu` - Show main menu
- Send an Inbox ID (64 hex chars) to check key packages
- Send an Ethereum address (0x + 40 hex chars) to check key packages
- Send custom load test parameters (e.g., "5 20" for 5 groups × 20 messages)

## Architecture

The bot uses a configurable inline actions system that allows for:

- Dynamic menu generation
- Configurable post-action behavior
- Extensible handler system
- Consistent navigation patterns

The configuration is handled through the `AppConfig` type in the inline-actions utility, making it easy to customize behavior across different bots.
