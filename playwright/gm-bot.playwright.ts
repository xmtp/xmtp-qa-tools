import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright-chromium";

let browser: Browser | null = null;

// Determine if we should run in headless mode (default to true in CI)
const isHeadless = process.env.GITHUB_ACTIONS !== undefined;
export async function testGmBot(gmBotAddress: string): Promise<boolean> {
  try {
    // Launch the browser
    browser = await chromium.launch({ headless: isHeadless });
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
    await new Promise((resolve) => setTimeout(resolve, 4000));
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

    return response === "gm";
  } catch (error) {
    console.error("Test failed:", error);
    return false;
  } finally {
    // Close the browser
    if (browser) await browser.close();
  }
}

export async function createGroupAndReceiveGm(addresses: string[]) {
  try {
    // Launch the browser
    browser = await chromium.launch({ headless: isHeadless });
    const context: BrowserContext = await browser.newContext();
    const page: Page = await context.newPage();

    console.log("Starting test");
    await page.goto(`https://xmtp.chat/`);
    await page.getByLabel("Settings").first().click();
    await page
      .locator("label")
      .filter({ hasText: "Use ephemeral account" })
      .locator("span")
      .first()
      .click();
    await page
      .locator('p:has-text("LOGGING")')
      .locator("xpath=..")
      .locator("select")
      .selectOption("debug");
    await page
      .locator('p:has-text("network")')
      .locator("xpath=..")
      .locator("select")
      .selectOption("production");
    await page
      .getByRole("banner")
      .getByRole("button", { name: "Connect" })
      .click();
    // Wait a couple seconds for the bot's response to appear
    await sleep(3000);
    await dismissErrorModal(page);
    // Wait a couple seconds for the bot's response to appear
    await sleep(1000);
    await page.getByRole("button", { name: "Sync" }).click();
    await sleep(1000);
    console.log("Connected");
    await page
      .getByRole("main")
      .getByRole("button", { name: "New conversation" })
      .click();
    // Wait a couple seconds for the bot's response to appear
    await sleep();
    await page.getByRole("textbox", { name: "Address" }).click();
    // Wait a couple seconds for the bot's response to appear
    await sleep();
    for (const address of addresses) {
      await page.getByRole("textbox", { name: "Address" }).fill(address);
      await page.getByRole("button", { name: "Add" }).click();
    }
    await page.getByRole("button", { name: "Create" }).click();
    // Wait a couple seconds for the bot's response to appear
    await sleep();
    await page.getByRole("textbox", { name: "Type a message..." }).click();
    // Wait a couple seconds for the bot's response to appear
    await sleep(1000);
    await page.getByRole("textbox", { name: "Type a message..." }).fill("gm");
    // Wait a couple seconds for the bot's response to appear
    await sleep(1000);
    await page.getByRole("button", { name: "Send" }).click();
    // Wait a couple seconds for the bot's response to appear
    // Wait a couple seconds for the bot's response to appear
    await sleep(4000);
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
  } catch (error) {
    console.error("Test failed:", error);
    return false;
  } finally {
    // Close the browser
    if (browser) await browser.close();
  }
}

// Add a function to check for and dismiss error modals
const dismissErrorModal = async (page: Page) => {
  try {
    const modalVisible = await page.getByText("error").isVisible();
    console.log("Modal visible", modalVisible);
    if (modalVisible) {
      await page.getByRole("button", { name: "OK" }).click();
      console.log("Dismissed error modal");
    }
  } catch (error: unknown) {
    // Ignore errors if the modal isn't present
    console.log("No error modal found", error);
  }
};
function sleep(ms: number = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
