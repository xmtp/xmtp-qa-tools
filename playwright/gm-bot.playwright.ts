import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright-chromium";

let browser: Browser | null = null;

const gmBotAddress = "0x3237451eb4b3Cd648fdcD9c7818C9B64b60e82fA";
export async function testGmBot(): Promise<boolean> {
  try {
    // Launch the browser
    browser = await chromium.launch({ headless: true });
    const context: BrowserContext = await browser.newContext();
    const page: Page = await context.newPage();
    console.log("Starting test");
    await page.goto(`https://xmtp.chat`);
    // Be more specific with the Settings button selector
    await page.getByLabel("Settings").first().click();
    await page
      .locator("label")
      .filter({ hasText: "Use ephemeral account" })
      .locator("span")
      .first()
      .click();
    await page
      .getByRole("banner")
      .getByRole("button", { name: "Connect" })
      .click();
    console.log("Connected");
    await page.goto(`https://xmtp.chat/dm/${gmBotAddress}?env=dev`);
    console.log("Navigated to GM bot");
    await page.getByRole("textbox", { name: "Type a message..." }).click();
    const message = "gm-" + Math.random().toString(36).substring(2, 15);
    console.log(`Sending message: ${message}`);
    await page
      .getByRole("textbox", { name: "Type a message..." })
      .fill(message);
    await page.getByRole("button", { name: "Send" }).click();
    console.log(`Sent message: ${message}`);

    // Wait a couple seconds for the bot's response to appear
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await page.waitForSelector(
      '[data-testid="virtuoso-item-list"] div:has-text("gm")',
    );
    console.log("Found response");
    // Get all messages and find the bot's response (should be the message after the one we sent)
    const messages = await page
      .getByTestId("virtuoso-item-list")
      .locator("div")
      .filter({ hasText: "gm" })
      .all();
    console.log("Found messages");
    const response =
      messages.length > 0
        ? await messages[messages.length - 1].textContent()
        : null;

    console.log(`Received response: ${response}`);

    return response == "gm";
  } catch (error) {
    console.error("Test failed:", error);
    return false;
  } finally {
    // Close the browser
    if (browser) await browser.close();
  }
}
