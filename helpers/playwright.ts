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
}

export class XmtpPlaywright {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly isHeadless: boolean;
  private readonly env: XmtpEnv;
  private readonly walletKey: string;
  private readonly encryptionKey: string;
  private readonly defaultUser: boolean;

  constructor(
    {
      headless = true,
      env = null,
      defaultUser = false,
    }: XmtpPlaywrightOptions = {
      headless: true,
      env: null,
      defaultUser: false,
    },
  ) {
    this.isHeadless =
      process.env.GITHUB_ACTIONS !== undefined ? true : headless;
    this.env = env ?? (process.env.XMTP_ENV as XmtpEnv);
    console.log("Starting XmtpPlaywright with env:", this.env);
    this.walletKey = process.env.WALLET_KEY as string;
    this.encryptionKey = process.env.ENCRYPTION_KEY as string;
    this.defaultUser = defaultUser;
  }

  /**
   * Creates a group, adds the provided addresses, and tests for an expected response
   */
  async createGroupAndReceiveGm(
    addresses: string[],
    expectedResponse?: string | string[],
  ): Promise<void> {
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
      await this.takeSnapshot(session.page, "before-finding-gm");
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
    const session = await this.startPage(address);
    try {
      return await this.sendAndWaitForResponse(
        session.page,
        sendMessage,
        expectedMessage,
      );
    } catch (error) {
      console.error("Could not find expected message:", error);
      await this.takeSnapshot(session.page, "before-finding-expected-message");
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
    const screenshotPath = path.join(snapshotDir, `${name}-${timestamp}.png`);
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
      await this.takeSnapshot(page, "before-finding-expected-message");
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
    // Wait for messages to appear in the virtuoso list
    await page.waitForSelector('div[data-testid="virtuoso-item-list"] > div', {
      timeout: defaultValues.streamTimeout,
    });

    // Get initial message count
    const initialMessageCount = await page
      .locator('div[data-testid="virtuoso-item-list"] > div')
      .count();
    console.log(`Initial message count: ${initialMessageCount}`);

    // Convert expected message to array for consistent handling
    const expectedPhrases = expectedMessage
      ? Array.isArray(expectedMessage)
        ? expectedMessage
        : [expectedMessage]
      : [];

    const timeout = defaultValues.streamTimeout * 2;
    let timer = 0;
    // Poll for new messages
    while (timer < timeout) {
      await page.waitForTimeout(1000);
      timer += 1000;
      const currentMessageCount = await page
        .locator('div[data-testid="virtuoso-item-list"] > div')
        .count();

      if (currentMessageCount > initialMessageCount) {
        const responseText = await this.getLatestMessageText(page);

        // If no expected message, any response is valid
        if (!expectedPhrases.length) {
          console.log(`Received a response: "${responseText}"`);
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
    }

    console.log(
      expectedPhrases.length
        ? `Failed to find response containing any of [${expectedPhrases.join(", ")}]`
        : "Failed to receive any response",
    );

    return false;
  }

  /**
   * Gets the text of the latest message in the conversation
   */
  private async getLatestMessageText(page: Page): Promise<string> {
    const messageItems = await page
      .locator('div[data-testid="virtuoso-item-list"] > div')
      .all();

    if (messageItems.length === 0) return "";

    const latestMessageElement = messageItems[messageItems.length - 1];
    const responseText = (await latestMessageElement.textContent()) || "";
    console.log(`Latest message: "${responseText}"`);

    return responseText;
  }

  /**
   * Starts a new page with the specified options
   */
  private async startPage(address?: string): Promise<BrowserSession> {
    const browser = await chromium.launch({
      headless: this.isHeadless,
      slowMo: this.isHeadless ? 0 : 100,
    });

    const context: BrowserContext = await browser.newContext(
      this.isHeadless ? {} : {},
    );

    const page = await context.newPage();

    await this.setLocalStorage(
      page,
      this.defaultUser ? this.walletKey : "",
      this.defaultUser ? this.encryptionKey : "",
    );

    const url = address
      ? `https://xmtp.chat/dm/${address}?env=${this.env}`
      : "https://xmtp.chat/";

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
