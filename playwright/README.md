# 🎭 XMTP Playwright Testing

Automate browser testing for XMTP apps with Playwright. Talk to bots, send messages, verify everything works!

## 🚀 Quick Start

```bash
# Run all tests
yarn test:playwright

# Run just the chat test
yarn test xmtpchat
```

## 💬 GM Bot Test Example

```typescript
import { chromium } from "playwright-chromium";

export async function testGmBot(gmBotAddress: string): Promise<boolean> {
  const browser = await chromium.launch({
    headless: process.env.GITHUB_ACTIONS !== undefined,
  });

  try {
    const page = await browser.newContext().then((ctx) => ctx.newPage());

    // Connect to XMTP
    await page.goto("https://xmtp.chat");
    await page.getByLabel("Settings").first().click();
    await page
      .locator("label")
      .filter({ hasText: "Use ephemeral account" })
      .locator("span")
      .first()
      .click();
    await page.getByRole("button", { name: "Connect" }).click();

    // Chat with the bot
    await page.goto(`https://xmtp.chat/dm/${gmBotAddress}?env=dev`);

    // Send random message
    const message = "gm-" + Math.random().toString(36).substring(2, 15);
    await page
      .getByRole("textbox", { name: "Type a message..." })
      .fill(message);
    await page.getByRole("button", { name: "Send" }).click();

    // Check if bot responds
    await page.waitForSelector(
      '[data-testid="virtuoso-item-list"] div:has-text("gm")',
    );
    const messages = await page
      .getByTestId("virtuoso-item-list")
      .locator("div")
      .filter({ hasText: "gm" })
      .all();

    return (
      messages.length > 0 &&
      (await messages[messages.length - 1].textContent()) === "gm"
    );
  } finally {
    await browser.close();
  }
}
```

## 🧪 Testing Patterns

| Pattern             | Technique                                |
| ------------------- | ---------------------------------------- |
| 🔐 **Auth**         | Use ephemeral account for quick testing  |
| 🧭 **Navigation**   | Direct URL access with `page.goto()`     |
| 👆 **Interaction**  | Role-based selectors for reliable clicks |
| ✅ **Verification** | Wait for elements and check content      |
| 🧹 **Cleanup**      | Always close browser in `finally` block  |

## 🔍 Selector Tips

```typescript
// By role (preferred)
page.getByRole("button", { name: "Send" });

// By test ID (reliable)
page.getByTestId("message-list");

// By text content (use sparingly)
page.locator("div").filter({ hasText: "gm" });
```

## 📺 Visual Debugging

Run with headless mode disabled to see what's happening:

```typescript
const browser = await chromium.launch({ headless: false, slowMo: 100 });
```
