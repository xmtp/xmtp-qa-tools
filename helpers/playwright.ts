import fs from "fs";
import path from "path";
import type { XmtpEnv } from "@xmtp/node-sdk";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright-chromium";
import { defaultValues } from "./tests";

export class XmtpPlaywright {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isHeadless: boolean = true;
  private env: XmtpEnv = "local";
  private walletKey: string = "";
  private encryptionKey: string = "";
  private defaultUser: boolean = false;
  constructor(
    headless: boolean = true,
    env: XmtpEnv | null = null,
    defaultUser: boolean = false,
  ) {
    this.isHeadless =
      process.env.GITHUB_ACTIONS !== undefined ? true : headless;
    this.env = env ?? (process.env.XMTP_ENV as XmtpEnv);
    this.walletKey = process.env.WALLET_KEY_XMTP_CHAT as string;
    this.encryptionKey = process.env.ENCRYPTION_KEY_XMTP_CHAT as string;
    this.browser = null;
    this.page = null;
    this.defaultUser = defaultUser;
  }

  /**
   * Creates a group and checks for GM response
   */
  async createGroupAndReceiveGm(addresses: string[]): Promise<void> {
    const { page, browser } = await this.startPage();
    try {
      console.log("Filling addresses and creating group");
      await this.fillAddressesAndCreate(page, addresses);
      const response = await this.sendAndWaitForResponse(page, "hi", "gm");
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
    const { page, browser } = await this.startPage();
    try {
      await page.goto(`https://xmtp.chat/group/${groupId}?env=${this.env}`);
      await this.takeSnapshot(page, "before-reading-group-messages");
      let allReceived = true;
      for (const message of messages) {
        // Wait for GM response with a longer timeout
        const botMessage = await page.getByText(message);
        const botMessageText = await botMessage.textContent();
        if (botMessageText !== message) {
          allReceived = false;
        }
      }
      return allReceived;
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
  private async sendAndWaitForResponse(
    page: Page,
    sendMessage: string,
    expectedMessage: string,
  ): Promise<boolean> {
    try {
      console.log("Waiting for message input to be visible");
      await page
        .getByRole("textbox", { name: "Type a message..." })
        .waitFor({ state: "visible" });
      console.log("Filling message");
      await page
        .getByRole("textbox", { name: "Type a message..." })
        .waitFor({ state: "visible" });
      await page
        .getByRole("textbox", { name: "Type a message..." })
        .fill(sendMessage);
      console.log("Sending message" + sendMessage);
      await page.waitForTimeout(1000);
      await page.getByRole("button", { name: "Send" }).click();
      await page.waitForTimeout(1000);
      const hiMessageLocator = page.getByText(sendMessage);
      await hiMessageLocator
        .waitFor({ state: "visible", timeout: defaultValues.streamTimeout })
        .catch((error: unknown) => {
          console.error("Failed to wait for hi message", error);
          return false;
        });
      const hiMessageText = await hiMessageLocator.textContent();
      console.log("Sent message:", hiMessageText?.toLowerCase());

      const botMessageLocator = page.getByText(expectedMessage);
      await botMessageLocator
        .waitFor({
          state: "visible",
          timeout: defaultValues.streamTimeout,
        })
        .catch((error: unknown) => {
          console.error("Failed to wait for bot message", error);
          return false;
        });
      const botMessageText = await botMessageLocator.textContent();
      console.log("Received message:", botMessageText?.toLowerCase());
      return (
        botMessageText?.toLowerCase().includes(expectedMessage.toLowerCase()) ??
        false
      );
    } catch (error) {
      console.error("Error in sendAndWaitForResponse:", error);
      return false;
    }
  }

  /**
   * Starts a new page with the specified options
   */
  private async startPage(
    address?: string,
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
      this.defaultUser ? this.walletKey : "",
      this.defaultUser ? this.encryptionKey : "",
    );

    let url = "https://xmtp.chat/";
    if (address) {
      url = `https://xmtp.chat/dm/${address}?env=${this.env}`;
    }
    console.log("Navigating to:", url);
    await this.page.goto(url);
    await this.page.waitForTimeout(1000);
    if (!this.defaultUser) {
      await this.page.getByText("Ephemeral", { exact: true }).click();
    }

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
    if (this.defaultUser) {
      console.log(
        "Setting localStorage",
        walletKey.slice(0, 4) + "...",
        walletEncryptionKey.slice(0, 4) + "...",
      );
    }
    await page.addInitScript(
      ({ envValue, walletKey, walletEncryptionKey }) => {
        if (walletKey !== "") console.log("Setting walletKey", walletKey);
        // @ts-expect-error Window localStorage access in browser context
        window.localStorage.setItem("XMTP_EPHEMERAL_ACCOUNT_KEY", walletKey);
        if (walletEncryptionKey !== "") {
          console.log("Setting walletEncryptionKey", walletEncryptionKey);
          // @ts-expect-error Window localStorage access in browser context
          window.localStorage.setItem(
            "XMTP_ENCRYPTION_KEY",
            walletEncryptionKey,
          );
        }
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

  /**
   * Tests a DM with an agent using deeplink
   */
  async newDmWithDeeplink(
    address: string,
    sendMessage: string,
    expectedMessage: string,
  ): Promise<boolean> {
    const { page, browser } = await this.startPage(address);
    try {
      return await this.sendAndWaitForResponse(
        page,
        sendMessage,
        expectedMessage,
      );
    } catch (error) {
      console.error("Could not find expected message:", error);
      await this.takeSnapshot(page, "before-finding-expected-message");
      return false;
    } finally {
      if (browser) await browser.close();
    }
  }
}
