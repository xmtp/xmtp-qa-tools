import fs from "fs";
import path from "path";
import type { XmtpEnv } from "@helpers/types";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright-chromium";

export class XmtpPlaywright {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isHeadless: boolean = true;
  private env: XmtpEnv = "local";
  private walletKey: string = "";
  private encryptionKey: string = "";
  constructor(headless: boolean = true, env: XmtpEnv | null = null) {
    this.isHeadless =
      process.env.GITHUB_ACTIONS !== undefined ? true : headless;
    this.env = env ?? (process.env.XMTP_ENV as XmtpEnv);
    this.walletKey = process.env.WALLET_KEY_XMTP_CHAT as string;
    this.encryptionKey = process.env.ENCRYPTION_KEY_XMTP_CHAT as string;
    this.browser = null;
    this.page = null;
  }

  /**
   * Creates a DM with deeplink and checks for GM response
   */
  async createDmWithDeeplink(address: string): Promise<boolean> {
    const { page, browser } = await this.startPage(false, address);
    try {
      console.log("Creating DM with deeplink");
      console.log("Sending message and waiting for GM response");
      const response = await this.sendAndWaitForGm(page, "gm");
      console.log("GM response:", response);
      return response;
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
    const { page, browser } = await this.startPage(false);
    try {
      console.log("Filling addresses and creating group");
      await this.fillAddressesAndCreate(page, addresses);
      console.log("Sending message and waiting for GM response");
      const response = await this.sendAndWaitForGm(page, "gm", waitForMessage);
      if (!response) {
        throw new Error("Failed to receive GM response");
      }
    } catch (error) {
      console.error("Error in createGroupAndReceiveGm:", error);
      await this.takeSnapshot(page, "before-finding-gm");
      throw error;
    } finally {
      if (browser) await browser.close();
    }
  }

  async readGroupMessages(
    groupId: string,
    messages: string[],
  ): Promise<boolean> {
    const { page, browser } = await this.startPage(false);
    await page.goto(`https://xmtp.chat/group/${groupId}?env=${this.env}`);
    await this.takeSnapshot(page, "before-reading-group-messages");
    let allReceived = true;
    for (const message of messages) {
      // Wait for GM response with a longer timeout
      const botMessage = await page.getByText(message);
      console.log("Bot message:", botMessage);
      const botMessageText = await botMessage.textContent();
      if (botMessageText !== message) {
        allReceived = false;
      }
    }
    return allReceived;
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
      .getByRole("button", { name: "Create a new group" })
      .click();
    await page.getByRole("button", { name: "Members" }).click();
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
    try {
      await page.getByRole("textbox", { name: "Type a message..." }).click();
      await page.getByRole("textbox", { name: "Type a message..." }).fill("hi");
      await page.getByRole("button", { name: "Send" }).click();

      const hiMessage = await page.getByText("hi");
      const hiMessageText = await hiMessage.textContent();
      console.log("Hi message:", hiMessageText);

      if (waitForMessage) {
        // Wait for GM response with a longer timeout
        const botMessage = await page.getByText("gm");
        console.log("Bot message:", botMessage);
        const botMessageText = await botMessage.textContent();
        return botMessageText === "gm";
      } else {
        return hiMessageText === "hi";
      }
    } catch (error) {
      console.error("Error in sendAndWaitForGm:", error);
      throw error;
    }
  }

  /**
   * Starts a new page with the specified options
   */
  private async startPage(
    defaultUser: boolean = false,
    address: string = "",
  ): Promise<{ browser: Browser; page: Page }> {
    this.browser = await chromium.launch({
      headless: this.isHeadless,
      slowMo: this.isHeadless ? 0 : 100,
    });

    const context: BrowserContext = await this.browser.newContext(
      this.isHeadless
        ? {
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1,
          }
        : {},
    );

    this.page = await context.newPage();

    await this.setLocalStorage(
      this.page,
      defaultUser ? this.walletKey : "",
      defaultUser ? this.encryptionKey : "",
    );

    let url = "https://xmtp.chat/";
    if (address) {
      url = `https://xmtp.chat/dm/${address}?env=${this.env}`;
    }
    console.log("Navigating to:", url);
    await this.page.goto(url);
    await this.page.waitForTimeout(1000);
    await this.page.getByText("Ephemeral", { exact: true }).click();

    return { browser: this.browser, page: this.page };
  }

  /**
   * Sets localStorage values for XMTP configuration
   */
  private async setLocalStorage(
    page: Page,
    walletKey: string = "",
    walletEncryptionKey: string = "",
  ): Promise<void> {
    await page.addInitScript(
      ({ envValue, walletKey, walletEncryptionKey }) => {
        if (walletKey !== "")
          // @ts-expect-error Window localStorage access in browser context
          window.localStorage.setItem("XMTP_EPHEMERAL_ACCOUNT_KEY", walletKey);
        if (walletEncryptionKey !== "")
          // @ts-expect-error Window localStorage access in browser context
          window.localStorage.setItem(
            "XMTP_ENCRYPTION_KEY",
            walletEncryptionKey,
          );
        // @ts-expect-error Window localStorage access in browser context
        window.localStorage.setItem("XMTP_NETWORK", envValue);
        // @ts-expect-error Window localStorage access in browser context
        window.localStorage.setItem("XMTP_USE_EPHEMERAL_ACCOUNT", "true");
      },
      {
        envValue: this.env,
        walletKey: walletKey,
        walletEncryptionKey: walletEncryptionKey,
      },
    );
  }
}
