import crypto from "crypto";
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

type BrowserSession = {
  browser: Browser;
  page: Page;
};

interface XmtpPlaywrightOptions {
  headless?: boolean;
  env?: XmtpEnv | null;
  defaultUser?: boolean;
  testId?: string; // Add test ID for unique identification
}

export class XmtpPlaywright {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly isHeadless: boolean;
  private readonly env: XmtpEnv;
  private readonly walletKey: string;
  private readonly encryptionKey: string;
  private readonly defaultUser: boolean;
  private readonly testId: string;

  constructor(
    {
      headless = true,
      env = null,
      defaultUser = false,
      testId = "",
    }: XmtpPlaywrightOptions = {
      headless: true,
      env: null,
      defaultUser: false,
      testId: "",
    },
  ) {
    this.isHeadless =
      process.env.GITHUB_ACTIONS !== undefined ? true : headless;
    this.env = env ?? (process.env.XMTP_ENV as XmtpEnv);
    console.log("Starting XmtpPlaywright with env:", this.env);
    this.walletKey = process.env.WALLET_KEY as string;
    this.encryptionKey = process.env.ENCRYPTION_KEY as string;
    this.defaultUser = defaultUser;
    // Generate a unique test ID if not provided
    this.testId = testId || crypto.randomUUID().substring(0, 8);
    console.log(`Test instance ID: ${this.testId}`);
  }

  /**
   * Resets the message tracking state
   */
  private resetMessageState(): void {
    // This method is kept for compatibility with existing code
    // but no longer needs to do anything
  }

  /**
   * Creates a group, adds the provided addresses, and tests for an expected response
   */
  async createGroupAndReceiveGm(
    addresses: string[],
    expectedResponse?: string | string[],
  ): Promise<void> {
    this.resetMessageState();
    const session = await this.startPage();
    try {
      await this.fillAddressesAndCreate(session.page, addresses);
      const response = await this.sendAndWaitForResponse(
        session.page,
        "hi",
        expectedResponse || "gm",
      );
      if (!response) {
        throw new Error("Failed to receive response");
      }
    } catch (error) {
      console.error("Error in createGroupAndReceiveGm:", error);
      await this.takeSnapshot(session.page, `before-finding-gm-${this.testId}`);
      throw error;
    } finally {
      await this.closeBrowser(session.browser);
    }
  }

  /**
   * Tests a DM with an agent using deeplink
   */
  async newDmWithDeeplink(
    address: string,
    sendMessage: string,
    expectedMessage?: string | string[],
  ): Promise<boolean> {
    this.resetMessageState();
    const session = await this.startPage(address);
    try {
      return await this.sendAndWaitForResponse(
        session.page,
        sendMessage,
        expectedMessage,
      );
    } catch (error) {
      console.error("Could not find expected message:", error);
      await this.takeSnapshot(
        session.page,
        `before-finding-expected-message-${this.testId}`,
      );
      return false;
    } finally {
      await this.closeBrowser(session.browser);
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
    const screenshotPath = path.join(
      snapshotDir,
      `${name}-${timestamp}-${this.testId}.png`,
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

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
   * Sends a message and waits for response in the message list
   */
  private async sendAndWaitForResponse(
    page: Page,
    sendMessage: string,
    expectedMessage?: string | string[],
  ): Promise<boolean> {
    try {
      await this.sendMessage(page, sendMessage);
      return await this.waitForResponse(page, expectedMessage);
    } catch (error) {
      console.error("Error in sendAndWaitForResponse:", error);
      await this.takeSnapshot(
        page,
        `before-finding-expected-message-${this.testId}`,
      );
      return false;
    }
  }

  /**
   * Sends a message in the current conversation
   */
  private async sendMessage(page: Page, message: string): Promise<void> {
    console.log("Waiting for message input to be visible");
    await page
      .getByRole("textbox", { name: "Type a message..." })
      .waitFor({ state: "visible" });

    console.log("Filling message");
    await page
      .getByRole("textbox", { name: "Type a message..." })
      .fill(message);

    console.log("Sending message", message);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Send" }).click();
  }

  /**
   * Waits for a response matching the expected message(s)
   */
  private async waitForResponse(
    page: Page,
    expectedMessage?: string | string[],
  ): Promise<boolean> {
    // Reset message tracking state at the beginning
    this.resetMessageState();

    // Wait for messages to appear in the virtuoso list
    await page.waitForSelector('div[data-testid="virtuoso-item-list"] > div', {
      timeout: defaultValues.streamTimeout,
    });

    // Get initial message count + 1 to account for the message we just sent
    const initialMessageCount =
      (await page
        .locator('div[data-testid="virtuoso-item-list"] > div')
        .count()) + 1;
    console.log(`Initial message count: ${initialMessageCount}`);

    // Convert expected message to array for consistent handling
    const expectedPhrases = expectedMessage
      ? Array.isArray(expectedMessage)
        ? expectedMessage
        : [expectedMessage]
      : [];

    // Set timeout parameters
    const startTime = Date.now();
    const maxWaitTime = defaultValues.streamTimeout * 2;
    const checkInterval = 1000; // Check every 1 second

    // Wait for response in a loop until timeout
    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(checkInterval);

      try {
        const currentMessageCount = await page
          .locator('div[data-testid="virtuoso-item-list"] > div')
          .count();

        if (currentMessageCount > initialMessageCount) {
          // Get the latest message text
          const messageItems = await page
            .locator('div[data-testid="virtuoso-item-list"] > div')
            .all();

          if (messageItems.length === 0) continue;

          const latestMessageElement = messageItems[messageItems.length - 1];
          const responseText = (await latestMessageElement.textContent()) || "";
          const latestCount = messageItems.length;
          console.log(`Latest message: "${responseText}" ${latestCount}`);
          if (latestCount > initialMessageCount && !expectedPhrases.length) {
            console.log(`Latest message: "${responseText}" ${latestCount}`);
            return true;
          }
          // Check if any of the expected phrases are in the response
          const messageFound = expectedPhrases.some((phrase) =>
            responseText.toLowerCase().includes(phrase.toLowerCase()),
          );

          if (messageFound) {
            console.log(
              `Found expected response containing one of [${expectedPhrases.join(", ")}]: "${responseText}"`,
            );
            return true;
          }
        }
      } catch (error) {
        console.error(
          `Error while checking for response: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continue the loop even if there's an error
      }
    }

    console.log(
      expectedPhrases.length
        ? `Timeout: Failed to find response containing any of [${expectedPhrases.join(", ")}] after ${maxWaitTime / 1000} seconds`
        : `Timeout: Failed to receive any response after ${maxWaitTime / 1000} seconds`,
    );

    return false;
  }

  /**
   * Starts a new page with the specified options
   */
  private async startPage(address?: string): Promise<BrowserSession> {
    this.resetMessageState();

    // Create unique user data dir for parallel execution
    const userDataDir = path.join(
      process.cwd(),
      ".playwright-data",
      `user-data-${this.testId}`,
    );
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    const browser = await chromium.launch({
      headless: this.isHeadless,
      slowMo: this.isHeadless ? 0 : 100,
    });

    const context: BrowserContext = await browser.newContext({
      userAgent: `XmtpPlaywrightTest/${this.testId}`,
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    await this.setLocalStorage(
      page,
      this.defaultUser ? this.walletKey : "",
      this.defaultUser ? this.encryptionKey : "",
    );

    const url = address
      ? `https://xmtp.chat/dm/${address}?env=${this.env}`
      : "https://xmtp.chat/";

    console.log("Address:", address);
    console.log("Env:", this.env);
    console.log("Navigating to:", url);
    await page.goto(url);
    await page.waitForTimeout(1000);

    if (!this.defaultUser) {
      await page.getByText("Ephemeral", { exact: true }).click();
    }

    return { browser, page };
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
        walletKey,
        walletEncryptionKey,
      },
    );
  }

  /**
   * Safely closes the browser
   */
  private async closeBrowser(browser: Browser): Promise<void> {
    if (browser) {
      await browser.close();
    }
  }
}
