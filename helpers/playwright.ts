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

export type BrowserSession = {
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
   * Takes a screenshot and saves it to the logs directory
   */
  async takeSnapshot(name: string): Promise<void> {
    if (!this.page) {
      throw new Error("Page is not initialized");
    }
    const snapshotDir = path.join(process.cwd(), "./logs");
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const screenshotPath = path.join(snapshotDir, `${name}-${timestamp}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
  }

  /**
   * Fills addresses and creates a new conversation
   */
  public async newGroupFromUI(address: string): Promise<void> {
    if (!this.page) {
      throw new Error("Page is not initialized");
    }
    // Target the second button with the menu popup attribute
    await this.page.locator('button[aria-haspopup="menu"]').nth(0).click();
    await this.page.getByRole("menuitem", { name: "New group" }).click();

    await this.page.getByRole("textbox", { name: "Address" }).fill(address);
    await this.page.getByRole("button", { name: "Create" }).click();
  }

  /**
   * Fills addresses and creates a new conversation
   */
  public async newDmFromUI(address: string): Promise<void> {
    if (!this.page) {
      throw new Error("Page is not initialized");
    }
    // Target the second button with the menu popup attribute
    await this.page.locator('button[aria-haspopup="menu"]').nth(0).click();
    await this.page
      .getByRole("menuitem", { name: "New direct message" })
      .click();

    await this.page.getByRole("textbox", { name: "Address" }).fill(address);
    await this.page.getByRole("button", { name: "Create" }).click();
  }
  /**
   * Sends a message in the current conversation
   */
  public async sendMessage(message: string): Promise<void> {
    if (!this.page) {
      throw new Error("Page is not initialized");
    }
    console.log("Waiting for message input to be visible");
    await this.page
      .getByRole("textbox", { name: "Type a message..." })
      .waitFor({ state: "visible" });

    console.log("Filling message");
    await this.page
      .getByRole("textbox", { name: "Type a message..." })
      .fill(message);

    console.log("Sending message", message);
    await this.page.waitForTimeout(1000);
    await this.page.getByRole("button", { name: "Send" }).click();
  }

  /**
   * Waits for a response matching the expected message(s)
   */
  public async waitForResponse(
    expectedMessage?: string | string[],
  ): Promise<boolean> {
    // Wait for messages to appear in the virtuoso list
    if (!this.page) {
      throw new Error("Page is not initialized");
    }
    await this.page.waitForSelector(
      'div[data-testid="virtuoso-item-list"] > div',
      {
        timeout: defaultValues.streamTimeout,
      },
    );

    // Get initial message count
    const initialMessageCount = await this.page
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
      await this.page.waitForTimeout(1000);
      timer += 1000;
      const currentMessageCount = await this.page
        .locator('div[data-testid="virtuoso-item-list"] > div')
        .count();

      if (currentMessageCount > initialMessageCount) {
        const responseText = await this.getLatestMessageText();

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

    throw new Error("Failed to receive any response");
  }

  /**
   * Gets the text of the latest message in the conversation
   */
  private async getLatestMessageText(): Promise<string> {
    if (!this.page) {
      throw new Error("Page is not initialized");
    }
    const messageItems = await this.page
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
  async startPage(): Promise<BrowserSession> {
    if (this.browser && this.page) {
      return { browser: this.browser, page: this.page };
    }
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

    const url = "https://xmtp.chat/";

    console.log("Navigating to:", url);
    await page.goto(url);
    await page.waitForTimeout(1000);

    if (!this.defaultUser) {
      await page.getByText("Ephemeral", { exact: true }).click();
    }

    this.page = page;
    this.browser = browser;
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
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
