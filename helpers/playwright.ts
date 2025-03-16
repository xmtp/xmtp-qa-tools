import fs from "fs";
import path from "path";
import type { XmtpEnv } from "@helpers/types";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright-chromium";

const snapshotDir = path.join(process.cwd(), "./data/snapshots");
let browser: Browser | null = null;
if (!fs.existsSync(snapshotDir)) {
  fs.mkdirSync(snapshotDir, { recursive: true });
}
let page: Page | null = null;

export async function createGroupAndReceiveGm(addresses: string[]) {
  try {
    const isHeadless = process.env.GITHUB_ACTIONS !== undefined;
    const XMTP_ENV = process.env.XMTP_ENV as XmtpEnv;
    const WALLET_KEY_XMTP_CHAT = process.env.WALLET_KEY_XMTP_CHAT as string;
    const ENCRYPTION_KEY_XMTP_CHAT = process.env
      .ENCRYPTION_KEY_XMTP_CHAT as string;

    browser = await chromium.launch({
      headless: isHeadless,
      // Add slower animations for debugging if not in CI
      slowMo: isHeadless ? 0 : 100,
    });

    // Create context with a larger viewport to ensure all messages are visible
    const context: BrowserContext = await browser.newContext(
      isHeadless
        ? {
            viewport: { width: 1920, height: 1080 }, // Use a large viewport size
            deviceScaleFactor: 1,
          }
        : {},
    );

    page = await context.newPage();

    // Fix: Pass the env value correctly to the init script
    await setLocalStorage(
      page,
      XMTP_ENV,
      WALLET_KEY_XMTP_CHAT,
      ENCRYPTION_KEY_XMTP_CHAT,
    );

    console.log("Starting test");
    await page.goto(`https://xmtp.chat/`);
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

    return botMessageText === "gm";
  } catch (error) {
    console.error("Could not find 'gm' message:", error);
    // Take a screenshot to see what's visible
    if (page) await takeSnapshot(page, "before-finding-gm", addresses);
  } finally {
    // Close the browser
    if (browser) await browser.close();
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
async function setLocalStorage(
  page: Page,
  XMTP_ENV: XmtpEnv,
  WALLET_KEY_XMTP_CHAT: string,
  ENCRYPTION_KEY_XMTP_CHAT: string,
) {
  await page.addInitScript(
    ({ envValue, walletKey, walletEncryptionKey }) => {
      console.log("env keys", { envValue, walletKey, walletEncryptionKey });

      //window.localStorage.setItem("XMTP_EPHEMERAL_ACCOUNT_KEY", walletKey);
      // window.localStorage.setItem("XMTP_ENCRYPTION_KEY", walletEncryptionKey);
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
