import fs from "fs";
import path from "path";
import type { Client, DecodedMessage, Group, XmtpEnv } from "@helpers/types";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright-chromium";

export class XmtpPlaywright {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * Creates a DM with deeplink and checks for GM response
   */
  async createDmWithDeeplink(address: string): Promise<boolean> {
    const { page, browser } = await this.startPage(false, false, address);
    try {
      await page.getByText("Ephemeral", { exact: true }).click();
      await page.getByRole("textbox", { name: "Type a message..." }).click();
      await page.getByRole("textbox", { name: "Type a message..." }).fill("hi");
      await page.getByRole("button", { name: "Send" }).click();
      await page.waitForTimeout(1000);
      const botMessage = await page.getByText("gm");
      const botMessageText = await botMessage.textContent();
      return botMessageText === "gm";
    } catch (error) {
      console.error("Could not find 'gm' message:", error);
      await this.takeSnapshot(page, "before-finding-gm");
      return false;
    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * Creates a group and checks for GM response
   */
  async createGroupAndReceiveGm(
    addresses: string[],
    waitForMessage: boolean = true,
  ): Promise<void> {
    const { page, browser } = await this.startPage(true);
    try {
      await this.fillAddressesAndCreate(page, addresses);
      await this.sendAndWaitForGm(page, "gm", waitForMessage);
    } catch (error) {
      console.error("Could not find 'gm' message:", error);
      await this.takeSnapshot(page, "before-finding-gm");
    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * Takes a screenshot and saves it to the logs directory
   */
  async takeSnapshot(page: Page, name: string): Promise<void> {
    const snapshotDir = path.join(process.cwd(), "./logs");
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const screenshotPath = path.join(snapshotDir, `${name}-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  // Private helper methods

  /**
   * Fills addresses and creates a new conversation
   */
  private async fillAddressesAndCreate(
    page: Page,
    addresses: string[],
  ): Promise<void> {
    if (!page) {
      throw new Error("Page is not initialized");
    }

    await page
      .getByRole("main")
      .getByRole("button", { name: "New conversation" })
      .click();

    for (const address of addresses) {
      await page.getByRole("textbox", { name: "Address" }).fill(address);
      await page.getByRole("button", { name: "Add" }).click();
    }

    await page.getByRole("button", { name: "Create" }).click();
  }

  /**
   * Sends a message and optionally waits for GM response
   */
  private async sendAndWaitForGm(
    page: Page,
    message: string,
    waitForMessage: boolean = true,
  ): Promise<boolean> {
    await page.getByRole("textbox", { name: "Type a message..." }).click();
    await page.getByRole("textbox", { name: "Type a message..." }).fill("hi");
    await page.getByRole("button", { name: "Send" }).click();

    const hiMessage = await page.getByText("hi");
    const hiMessageText = await hiMessage.textContent();

    if (waitForMessage) {
      await page.waitForSelector(`text=${message}`);
      const botMessage = await page.getByText("gm");
      const botMessageText = await botMessage.textContent();
      return botMessageText === "gm";
    } else {
      return hiMessageText === "hi";
    }
  }

  /**
   * Starts a new page with the specified options
   */
  private async startPage(
    defaultUser: boolean = false,
    headless: boolean = true,
    address: string = "",
  ): Promise<{ browser: Browser; page: Page }> {
    const isHeadless =
      process.env.GITHUB_ACTIONS !== undefined ? true : headless;
    const XMTP_ENV = process.env.XMTP_ENV as XmtpEnv;
    const WALLET_KEY_XMTP_CHAT = process.env.WALLET_KEY_XMTP_CHAT as string;
    const ENCRYPTION_KEY_XMTP_CHAT = process.env
      .ENCRYPTION_KEY_XMTP_CHAT as string;

    this.browser = await chromium.launch({
      headless: isHeadless,
      slowMo: isHeadless ? 0 : 100,
    });

    const context: BrowserContext = await this.browser.newContext(
      isHeadless
        ? {
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1,
          }
        : {},
    );

    this.page = await context.newPage();

    await this.setLocalStorage(
      this.page,
      XMTP_ENV,
      defaultUser ? WALLET_KEY_XMTP_CHAT : "",
      defaultUser ? ENCRYPTION_KEY_XMTP_CHAT : "",
    );

    let url = "https://xmtp.chat/";
    if (address) {
      url = `https://xmtp.chat/${address}?env=${XMTP_ENV}`;
    }

    await this.page.goto(url);
    await this.page.waitForTimeout(1000);

    return { browser: this.browser, page: this.page };
  }

  /**
   * Sets localStorage values for XMTP configuration
   */
  private async setLocalStorage(
    page: Page,
    XMTP_ENV: XmtpEnv,
    WALLET_KEY_XMTP_CHAT: string,
    ENCRYPTION_KEY_XMTP_CHAT: string,
  ): Promise<void> {
    await page.addInitScript(
      ({ envValue, walletKey, walletEncryptionKey }) => {
        // @ts-expect-error Window localStorage access in browser context
        window.localStorage.setItem("XMTP_EPHEMERAL_ACCOUNT_KEY", walletKey);
        // @ts-expect-error Window localStorage access in browser context
        window.localStorage.setItem("XMTP_ENCRYPTION_KEY", walletEncryptionKey);
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
}
