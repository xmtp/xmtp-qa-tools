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

interface playwrightOptions {
  headless?: boolean;
  env?: XmtpEnv | null;
  defaultUser?: boolean;
}

export class playwright {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly isHeadless: boolean;
  private readonly env: XmtpEnv;
  private readonly walletKey: string;
  private readonly encryptionKey: string;
  private readonly defaultUser: boolean;

  constructor(
    { headless = true, env = null, defaultUser = false }: playwrightOptions = {
      headless: true,
      env: null,
      defaultUser: false,
    },
  ) {
    this.isHeadless =
      process.env.GITHUB_ACTIONS !== undefined ? true : headless;
    this.env = env ?? (process.env.XMTP_ENV as XmtpEnv);
    this.walletKey = process.env.WALLET_KEY as string;
    this.encryptionKey = process.env.ENCRYPTION_KEY as string;
    this.defaultUser = defaultUser;
    console.debug("Starting playwright with env:", this.env);
  }

  /**
   * Takes a screenshot and saves it to the logs directory
   */
  async takeSnapshot(name: string): Promise<void> {
    if (!this.page) throw new Error("Page is not initialized");

    const snapshotDir = path.join(process.cwd(), "./logs/screenshots");
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
  public async newGroupFromUI(addresses: string[]): Promise<void> {
    if (!this.page) throw new Error("Page is not initialized");

    // Target the second button with the menu popup attribute
    await this.page.locator('button[aria-haspopup="menu"]').nth(0).click();
    await this.page.getByRole("menuitem", { name: "New group" }).click();

    await this.page.getByRole("button", { name: "Members" }).click();

    const addressInput = this.page.getByRole("textbox", { name: "Address" });
    for (const address of addresses) {
      await addressInput.fill(address);
      await this.page.getByRole("button", { name: "Add" }).click();
    }

    await this.page.getByRole("button", { name: "Create" }).click();
    await addressInput.waitFor({ state: "hidden" });
    return;
  }

  /**
   * Fills addresses and creates a new conversation
   */
  public async newDmFromUI(address: string): Promise<void> {
    if (!this.page) throw new Error("Page is not initialized");

    // Target the second button with the menu popup attribute
    await this.page.locator('button[aria-haspopup="menu"]').nth(0).click();
    await this.page
      .getByRole("menuitem", { name: "New direct message" })
      .click();
    const addressInput = this.page.getByRole("textbox", { name: "Address" });
    await addressInput.waitFor({ state: "visible" });
    await addressInput.fill(address);
    await this.page.getByRole("button", { name: "Create" }).click();
    await addressInput.waitFor({ state: "hidden" });
    return;
  }
  /**
   * Sends a message in the current conversation
   */
  public async sendMessage(message: string): Promise<void> {
    if (!this.page) throw new Error("Page is not initialized");

    // Wait for the textbox to be visible
    const messageInput = this.page.getByRole("textbox", {
      name: "Type a message...",
    });
    await messageInput.waitFor({ state: "visible" });
    await this.page.waitForTimeout(defaultValues.playwrightBeforeSendTimeout);

    console.debug("Filling message");
    await messageInput.fill(message);

    console.debug("Sending message", message);
    await this.page.getByRole("button", { name: "Send" }).click();
  }

  /**
   * Waits for a response matching the expected message(s)
   */
  public async waitForResponse(expectedMessage: string[]): Promise<boolean> {
    if (!this.page) throw new Error("Page is not initialized");
    for (let i = 0; i < 6; i++) {
      await this.page.waitForTimeout(defaultValues.streamTimeout);
      const responseText = await this.getLatestMessageText();
      if (
        expectedMessage.some((phrase) =>
          responseText.toLowerCase().includes(phrase.toLowerCase()),
        )
      ) {
        return true;
      }
      console.debug(`No response found after ${i + 1} checks`);
    }
    return false;
  }

  /**
   * Gets the text of the latest message in the conversation
   */
  private async getLatestMessageText(): Promise<string> {
    if (!this.page) throw new Error("Page is not initialized");

    const messageItems = await this.page
      .locator('div[data-testid="virtuoso-item-list"] > div')
      .all();

    if (messageItems.length === 0) return "";

    const latestMessageElement = messageItems[messageItems.length - 1];
    const responseText = (await latestMessageElement.textContent()) || "";
    console.debug(`Latest message: "${responseText}"`);

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

    console.debug("Navigating to:", url);
    await page.goto(url);

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
      console.debug(
        "Setting localStorage",
        walletKey.slice(0, 4) + "...",
        walletEncryptionKey.slice(0, 4) + "...",
      );
    }

    await page.addInitScript(
      ({ envValue, walletKey, walletEncryptionKey }) => {
        if (walletKey !== "") console.debug("Setting walletKey", walletKey);
        // @ts-expect-error Window localStorage access in browser context
        window.localStorage.setItem("XMTP_EPHEMERAL_ACCOUNT_KEY", walletKey);

        if (walletEncryptionKey !== "") {
          console.debug("Setting walletEncryptionKey", walletEncryptionKey);
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
