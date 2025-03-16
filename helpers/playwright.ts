import fs from "fs";
import path from "path";
import type { Client, DecodedMessage, Group, XmtpEnv } from "@helpers/types";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from "playwright-chromium";

const snapshotDir = path.join(process.cwd(), ".data/snapshots");
const storageStatePath = path.join(process.cwd(), ".data/storageState.json");
let browser: Browser | null = null;
if (!fs.existsSync(snapshotDir)) {
  fs.mkdirSync(snapshotDir, { recursive: true });
}

// Create a shared context that can be reused
let sharedContext: BrowserContext | null = null;

// Function to initialize browser if not already initialized
async function initBrowser() {
  if (!browser) {
    const isHeadless = process.env.GITHUB_ACTIONS !== undefined;
    browser = await chromium.launch({
      headless: isHeadless,
      // Add slower animations for debugging if not in CI
      slowMo: isHeadless ? 0 : 100,
    });
  }
  return browser;
}

// Function to get or create a shared context
async function getSharedContext(
  useStorageState = true,
): Promise<BrowserContext> {
  const browser = await initBrowser();
  const isHeadless = process.env.GITHUB_ACTIONS !== undefined;

  // If we already have a shared context, return it
  if (sharedContext) {
    return sharedContext;
  }

  // Create a new context with storage state if it exists and is requested
  const contextOptions: BrowserContextOptions = isHeadless
    ? {
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      }
    : {};

  // Use storage state if it exists and is requested
  if (useStorageState && fs.existsSync(storageStatePath)) {
    contextOptions.storageState = storageStatePath;
  }

  sharedContext = await browser.newContext(contextOptions);
  return sharedContext;
}

// Function to save the current storage state
async function saveStorageState() {
  if (sharedContext) {
    await sharedContext.storageState({ path: storageStatePath });
    console.log("Storage state saved to:", storageStatePath);
  }
}

export async function createGroupAndReceiveGm(addresses: string[]) {
  await initBrowser();
  const context = await getSharedContext(false); // Don't use storage state for this test
  const page = await context.newPage();

  try {
    console.log("Starting test");
    await page.goto(`https://xmtp.chat/`);

    // Set up localStorage for this page
    const XMTP_ENV = process.env.XMTP_ENV as XmtpEnv;
    await setLocalStorage(page, XMTP_ENV, "", "");

    await page
      .getByRole("main")
      .getByRole("button", { name: "Connect" })
      .click();
    await page
      .getByRole("main")
      .getByRole("button", { name: "New conversation" })
      .click();
    console.log("Clicking address textbox");
    await page.getByRole("textbox", { name: "Address" }).click();
    for (const address of addresses) {
      console.log(`Filling address: ${address}`);
      await page.getByRole("textbox", { name: "Address" }).fill(address);
      console.log("Clicking Add button");
      await page.getByRole("button", { name: "Add" }).click();
    }
    console.log("Clicking Create button");
    await page.getByRole("button", { name: "Create" }).click();
    console.log("Clicking message textbox");
    await page.getByRole("textbox", { name: "Type a message..." }).click();
    console.log("Filling message with 'hi'");
    await page.getByRole("textbox", { name: "Type a message..." }).fill("hi");
    console.log("Clicking Send button");
    await page.getByRole("button", { name: "Send" }).click();

    const hiMessage = await page.getByText("hi");
    const hiMessageText = await hiMessage.textContent();
    console.log("hiMessageText", hiMessageText);
    const botMessage = await page.getByText("gm");
    const botMessageText = await botMessage.textContent();
    console.log("botMessageText", botMessageText);

    // Save the storage state after successful test
    await saveStorageState();

    return botMessageText === "gm";
  } catch (error) {
    console.error("Could not find 'gm' message:", error);
    // Take a screenshot to see what's visible
    if (page) await takeSnapshot(page, "before-finding-gm", addresses);
    return false;
  } finally {
    // Close the page but keep the context and browser
    await page.close();
  }
}

// Helper function to take snapshots
async function takeSnapshot(page: Page, name: string, addresses: string[]) {
  if (addresses.length > 1) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const screenshotPath = path.join(snapshotDir, `${name}-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log(`Snapshot saved: ${name} (${screenshotPath})`);
  }
}

// Helper function to check if a group exists in the web client
export async function checkGroupInWebClient(
  message: DecodedMessage,
  client: Client,
): Promise<{ success: boolean; error?: string }> {
  const group = await client.conversations.getConversationById(
    message.conversationId,
  );
  if (!group) {
    return { success: false, error: "Group not found" };
  }
  const groupName = (group as Group).name;

  // Use the shared context
  const context = await getSharedContext();
  const page = await context.newPage();

  // Set up localStorage
  const XMTP_ENV = process.env.XMTP_ENV as XmtpEnv;
  const WALLET_KEY_XMTP_CHAT = process.env.WALLET_KEY_XMTP_CHAT as string;
  const ENCRYPTION_KEY_XMTP_CHAT = process.env
    .ENCRYPTION_KEY_XMTP_CHAT as string;

  await setLocalStorage(
    page,
    XMTP_ENV,
    WALLET_KEY_XMTP_CHAT,
    ENCRYPTION_KEY_XMTP_CHAT,
  );

  try {
    await page.goto(`https://xmtp.chat/`);

    // Connect wallet
    console.log("Connecting wallet");
    await page
      .getByRole("main")
      .getByRole("button", { name: "Connect" })
      .click();

    // Wait for conversations to load
    console.log("Waiting for conversations to load");
    await page.waitForTimeout(2000);

    // Click sync button to refresh conversations
    console.log("Clicking sync button");
    await page.getByRole("button", { name: "Sync" }).click();
    await page.waitForTimeout(3000);

    // Look for the group with the specified name
    console.log(`Looking for group: "${groupName}"`);
    const groupElement = page.getByText(groupName, { exact: true });

    // Check if the group exists
    const isGroupVisible = await groupElement.isVisible();

    // Save the storage state after successful check
    await saveStorageState();

    if (isGroupVisible) {
      console.log(`Group "${groupName}" found in web client`);
      return { success: true };
    } else {
      console.log(`Group "${groupName}" not found in web client`);
      return { success: false, error: "Group not visible after sync" };
    }
  } catch (error: any) {
    console.error("Error checking group in web client:", error);
    return { success: false, error: error.message || "Unknown error" };
  } finally {
    // Close the page but keep the context and browser
    await page.close();
  }
}

// Add a function to close the browser and clean up resources
export async function closeBrowser() {
  if (sharedContext) {
    await sharedContext.close();
    sharedContext = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

async function setLocalStorage(
  page: Page,
  XMTP_ENV: XmtpEnv,
  WALLET_KEY_XMTP_CHAT: string,
  ENCRYPTION_KEY_XMTP_CHAT: string,
) {
  await page.addInitScript(
    ({ envValue, walletKey, walletEncryptionKey }) => {
      console.log("env keys", { envValue, walletKey, walletEncryptionKey });
      if (walletKey && walletEncryptionKey) {
        // @ts-expect-error Window localStorage access in browser context
        window.localStorage.setItem("XMTP_EPHEMERAL_ACCOUNT_KEY", walletKey);
        // @ts-expect-error Window localStorage access in browser context
        window.localStorage.setItem("XMTP_ENCRYPTION_KEY", walletEncryptionKey);
      }
      // @ts-expect-error Window localStorage access in browser context
      window.localStorage.setItem("XMTP_NETWORK", envValue);
      // @ts-expect-error Window localStorage access in browser context
      window.localStorage.setItem("XMTP_USE_EPHEMERAL_ACCOUNT", "true");
    },
    {
      envValue: XMTP_ENV,
      walletKey: WALLET_KEY_XMTP_CHAT,
      walletEncryptionKey: ENCRYPTION_KEY_XMTP_CHAT,
    },
  );
}
