import fs from "fs";
import path from "path";
import type { XmtpEnv } from "@xmtp/node-sdk";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright-chromium";
import { defaultValues } from "./utils";

// Default timeout for stream collection in milliseconds
const DEFAULT_STREAM_TIMEOUT_MS = process.env.DEFAULT_STREAM_TIMEOUT_MS
  ? parseInt(process.env.DEFAULT_STREAM_TIMEOUT_MS)
  : defaultValues.streamTimeout; // 3 seconds

export type BrowserSession = {
  browser: Browser;
  page: Page;
};

interface playwrightOptions {
  headless?: boolean;
  env?: XmtpEnv | null;
  defaultUser?: {
    walletKey: string;
    accountAddress: string;
    dbEncryptionKey: string;
    inboxId: string;
  };
}

export class playwright {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly isHeadless: boolean;
  private readonly env: XmtpEnv;
  private readonly defaultUser: {
    walletKey: string;
    accountAddress: string;
    dbEncryptionKey: string;
    inboxId: string;
  };

  constructor(
    {
      headless = true,
      env = null,
      defaultUser = undefined,
    }: playwrightOptions = {
      headless: true,
      env: null,
      defaultUser: undefined,
    },
  ) {
    this.isHeadless =
      process.env.GITHUB_ACTIONS !== undefined ? true : headless;
    this.env = env ?? (process.env.XMTP_ENV as XmtpEnv);
    this.defaultUser = defaultUser ?? {
      walletKey: "",
      accountAddress: "",
      dbEncryptionKey: "",
      inboxId: "",
    };
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

  public async addMemberToGroup(
    groupId: string,
    address: string,
  ): Promise<void> {
    if (!this.page) throw new Error("Page is not initialized");

    await this.page.goto(`https://xmtp.chat/conversations/group/${groupId}`);
    await this.page.getByRole("button", { name: "Members" }).click();
    await this.page.getByRole("textbox", { name: "Address" }).fill(address);
    await this.page.getByRole("button", { name: "Add" }).click();
  }

  public async newGroupFromUI(addresses: string[]): Promise<string> {
    if (!this.page) throw new Error("Page is not initialized");

    // Target the second button with the menu popup attribute
    await this.page.goto("https://xmtp.chat/conversations/new-group");
    await this.page.getByRole("button", { name: "Members" }).click();

    const addressInput = this.page.getByRole("textbox", { name: "Address" });
    for (const address of addresses) {
      await addressInput.fill(address);
      await this.page.getByRole("button", { name: "Add" }).click();
    }

    await this.page.getByRole("button", { name: "Create" }).click();
    await addressInput.waitFor({ state: "hidden" });

    const url = this.page.url();
    const groupId = url.split("/conversations/")[1];
    console.debug("Created group with ID:", groupId);
    return groupId;
  }

  /**
   * Fills addresses and creates a new conversation
   */
  public async newDmFromUI(address: string): Promise<void> {
    if (!this.page) throw new Error("Page is not initialized");
    console.debug("Navigating to new DM");
    await this.page.goto("https://xmtp.chat/conversations/new-dm");
    console.debug("Filling address");
    const addressInput = this.page.getByRole("textbox", { name: "Address" });
    await addressInput.waitFor({ state: "visible" });
    console.debug("Filled address");
    await addressInput.fill(address);
    console.debug("Clicked create");
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
  public async waitForNewConversation(groupName: string): Promise<boolean> {
    if (!this.page) throw new Error("Page is not initialized");
    for (let i = 0; i < DEFAULT_STREAM_TIMEOUT_MS / 1000; i++) {
      await this.page.waitForTimeout(1000);
      const responseText = await this.getLatestGroupFromList();
      console.debug(`Latest group: "${responseText}"`);
      if (responseText.includes(groupName)) {
        return true;
      }
      console.debug(`No response found after ${i + 1} checks`);
    }
    return false;
  }
  private async getLatestGroupFromList(): Promise<string> {
    if (!this.page) throw new Error("Page is not initialized");

    const messageItems = await this.page
      .getByRole("navigation")
      .getByTestId("virtuoso-item-list")
      .locator("div")
      .all();

    if (messageItems.length === 0) return "";

    const latestMessageElement = messageItems[messageItems.length - 1];
    const responseText = (await latestMessageElement.textContent()) || "";
    console.debug(`Latest message: "${responseText}"`);

    return responseText;
  }

  /**
   * Waits for a response matching the expected message(s)
   */
  public async waitForResponse(expectedMessage: string[]): Promise<boolean> {
    if (!this.page) throw new Error("Page is not initialized");
    for (let i = 0; i < DEFAULT_STREAM_TIMEOUT_MS / 1000; i++) {
      await this.page.waitForTimeout(1000);
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
      .getByRole("main")
      .getByTestId("virtuoso-item-list")
      .locator("div")
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
      this.isHeadless ? {} : { viewport: { width: 1280, height: 720 } },
    );

    const page = await context.newPage();

    await this.setLocalStorage(
      page,
      this.defaultUser.walletKey,
      this.defaultUser.dbEncryptionKey,
    );

    const url = "https://xmtp.chat/";

    console.debug("Navigating to:", url);
    await page.goto(url);
    console.debug("Navigated to:", url);
    if (!this.defaultUser.walletKey) {
      console.debug("Navigating to welcome");
      await page.goto("https://xmtp.chat/welcome");
      console.debug("Clicked connect");

      // await page.getByRole("button", { name: "Connect" }).click();
      // console.debug("Clicked ephemeral wallet");
      // await page.getByText("Ephemeral wallet").click();
      // console.debug("Clicked ephemeral wallet");
    }
    console.debug("Waiting for title");
    await page.waitForSelector(".mantine-Title-root");
    console.debug("Navigated to welcome");
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
    if (this.defaultUser.walletKey) {
      console.debug(
        "Setting localStorage",
        this.defaultUser.walletKey.slice(0, 4) + "...",
        this.defaultUser.dbEncryptionKey.slice(0, 4) + "...",
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
