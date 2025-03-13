import type { XmtpEnv } from "@helpers/types";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright-chromium";

let browser: Browser | null = null;
export async function createGroupAndReceiveGm(addresses: string[]) {
  try {
    const isHeadless = process.env.GITHUB_ACTIONS !== undefined;
    const XMTP_ENV = process.env.XMTP_ENV as XmtpEnv;
    const WALLET_KEY_XMTP_CHAT = process.env.WALLET_KEY_XMTP_CHAT as string;
    const ENCRYPTION_KEY_XMTP_CHAT = process.env
      .ENCRYPTION_KEY_XMTP_CHAT as string;

    browser = await chromium.launch({ headless: isHeadless });
    const context: BrowserContext = await browser.newContext();
    const page: Page = await context.newPage();

    // Fix: Pass the env value correctly to the init script
    await context.addInitScript(
      ({ envValue, walletKey, walletEncryptionKey }) => {
        console.log("env keys", { envValue, walletKey, walletEncryptionKey });
        // @ts-expect-error Window localStorage access in browser context
        window.localStorage.setItem("XMTP_EPHEMERAL_ACCOUNT_KEY", walletKey);
        // @ts-expect-error Window localStorage access in browser context
        window.localStorage.setItem("XMTP_ENCRYPTION_KEY", walletEncryptionKey);
        // @ts-expect-error Window localStorage access in browser context
        window.localStorage.setItem("XMTP_NETWORK", envValue);
        // @ts-expect-error Window localStorage access in browser context
        window.localStorage.setItem("XMTP_LOGGING_LEVEL", "debug");
        // @ts-expect-error Window localStorage access in browser context
        window.localStorage.setItem("XMTP_USE_EPHEMERAL_ACCOUNT", "true");
      },
      {
        envValue: XMTP_ENV,
        walletKey: WALLET_KEY_XMTP_CHAT,
        walletEncryptionKey: ENCRYPTION_KEY_XMTP_CHAT,
      },
    );
    console.log("env keys", {
      envValue: XMTP_ENV,
      walletKey: WALLET_KEY_XMTP_CHAT,
      walletEncryptionKey: ENCRYPTION_KEY_XMTP_CHAT,
    });

    console.log("Starting test");
    await page.goto(`https://xmtp.chat/`);
    await page
      .getByRole("banner")
      .getByRole("button", { name: "Connect" })
      .click();
    await dismissErrorModal(page);
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
    await sleep(5000);
    await page.getByRole("textbox", { name: "Type a message..." }).click();
    await page.getByRole("textbox", { name: "Type a message..." }).fill("gm");
    await page.getByRole("button", { name: "Send" }).click();
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
    await sleep(1000);
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
