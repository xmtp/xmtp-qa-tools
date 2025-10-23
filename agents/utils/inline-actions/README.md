# Inline Actions

Interactive button-based UI for XMTP agents following the XIP-67 specification. Users can tap buttons instead of typing commands.

## Quick Start

```typescript
import {
  ActionBuilder,
  inlineActionsMiddleware,
  registerAction,
} from "./inline-actions";

// 1. Add middleware to your agent
agent.use(inlineActionsMiddleware);

// 2. Register action handlers
registerAction("my-action", async (ctx) => {
  await ctx.sendText("Action executed!");
});

// 3. Send interactive buttons
await ActionBuilder.create("my-menu", "Choose an option:")
  .add("my-action", "Click Me", "primary")
  .add("other-action", "Cancel", "secondary")
  .send(ctx);
```

## Core Functions

### ActionBuilder

Create interactive button menus:

```typescript
await ActionBuilder.create("menu-id", "Description")
  .add("action-id", "Button Label", "primary") // primary|secondary|danger
  .add("action-id-2", "Another Button")
  .send(ctx);

// With markdown support for the title
await ActionBuilder.create("menu-id", "**Bold Title**\n\n*Italic text*", true)
  .add("action-id", "Button Label")
  .send(ctx);
```

### Helper Functions

**Confirmation dialogs:**

```typescript
await sendConfirmation(
  ctx,
  "Delete this item?",
  async (ctx) => await ctx.sendText("Deleted!"),
  async (ctx) => await ctx.sendText("Cancelled"),
);

// With markdown support
await sendConfirmation(
  ctx,
  "**Are you sure?**\n\nThis action cannot be undone.",
  async (ctx) => await ctx.sendText("Deleted!"),
  async (ctx) => await ctx.sendText("Cancelled"),
  true, // Enable markdown
);
```

**Selection menus:**

```typescript
await sendSelection(ctx, "Pick a color:", [
  {
    id: "red",
    label: "🔴 Red",
    handler: async (ctx) => {
      /* handle red */
    },
  },
  {
    id: "blue",
    label: "🔵 Blue",
    handler: async (ctx) => {
      /* handle blue */
    },
  },
]);

// With markdown support
await sendSelection(
  ctx,
  "**Select an option:**\n\n- Choose carefully\n- This is important",
  [
    /* options */
  ],
  true, // Enable markdown
);
```

### App Configuration

For complex bots with multiple menus:

```typescript
const config: AppConfig = {
  name: "My Bot",
  menus: {
    "main-menu": {
      id: "main-menu",
      title: "Main Menu\nChoose an option below:",
      actions: [
        { id: "sub-menu", label: "Go to Sub Menu" },
        { id: "action-1", label: "Do Something", handler: myHandler },
      ],
    },
  },
};

initializeAppFromConfig(config);
```

## Action Handlers

Register handlers for button clicks:

```typescript
registerAction("my-action", async (ctx: MessageContext) => {
  // Handle the action
  await ctx.sendText("Action completed!");

  // Optionally show navigation options
  await showNavigationOptions(ctx, config, "What would you like to do next?");
});
```

## Validation Helpers

Built-in validators for common formats:

```typescript
import { validators } from "./inline-actions";

const result = validators.inboxId("123abc...");
if (!result.valid) {
  await ctx.sendText(`Error: ${result.error}`);
}
```

## Content Types

- **ActionsContent**: Agent sends interactive buttons
- **IntentContent**: User responds by tapping buttons

Both follow XIP-67 specification with proper encoding/decoding and validation.
