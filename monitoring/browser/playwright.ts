import fs from "fs";
import path from "path";
import { browserTimeout, streamColdStartTimeout } from "@helpers/client";
import type { XmtpEnv } from "@helpers/versions";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright-chromium";

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
  public browser: Browser | null = null;
  public page: Page | null = null;
  private readonly isHeadless: boolean;
  private readonly env: XmtpEnv;
  private readonly defaultUser: {
    walletKey: string;
    accountAddress: string;
    dbEncryptionKey: string;
    inboxId: string;
  };

  constructor(
    { headless = false, env = null, defaultUser }: playwrightOptions = {
      headless: false,
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
    console.debug(
      `Starting playwright with env: ${this.env}, headless: ${this.isHeadless}`,
    );
  }

  /**
   * Takes a screenshot and saves it to the logs directory
   */
  async takeSnapshot(name: string): Promise<void> {
    if (!this.page) return;

    const snapshotDir = path.join(process.cwd(), "./logs/screenshots");
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const screenshotPath = path.join(snapshotDir, `${name}-${timestamp}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    console.debug(`Screenshot saved: ${screenshotPath}`);
  }

  /**
   * Debug method to inspect DOM structure
   */
  async debugMessageList(): Promise<void> {
    if (!this.page) return;

    console.debug("=== Debugging Message List Structure ===");
    console.debug(`Current URL: ${this.page.url()}`);

    // Check for main element
    const mainCount = await this.page.getByRole("main").count();
    console.debug(`Main elements found: ${mainCount}`);

    // Check for virtuoso-item-list
    const virtuosoCount = await this.page
      .getByTestId("virtuoso-item-list")
      .count();
    console.debug(`virtuoso-item-list elements found: ${virtuosoCount}`);

    // Try to get all test IDs in main
    try {
      const testIds = await this.page
        .getByRole("main")
        .locator("[data-testid]")
        .all();
      console.debug(
        `Found ${testIds.length} elements with data-testid in main`,
      );
      for (let i = 0; i < Math.min(5, testIds.length); i++) {
        const testId = await testIds[i].getAttribute("data-testid");
        console.debug(`  - data-testid: ${testId}`);
      }
    } catch (error) {
      console.debug("Could not get test IDs:", error);
    }

    // Try to get message-like elements
    try {
      const messageElements = await this.page
        .getByRole("main")
        .locator("div")
        .all();
      console.debug(`Found ${messageElements.length} div elements in main`);

      // Get text from last few elements
      for (
        let i = Math.max(0, messageElements.length - 3);
        i < messageElements.length;
        i++
      ) {
        const text = await messageElements[i].textContent();
        console.debug(`  Element ${i}: "${text?.slice(0, 100)}"`);
      }
    } catch (error) {
      console.debug("Could not get message elements:", error);
    }

    console.debug("=== End Debug ===");
  }

  public async addMemberToGroup(
    groupId: string,
    address: string,
  ): Promise<void> {
    try {
      if (!this.page) throw new Error("Page is not initialized");

      // Navigate using client-side routing instead of page reload
      const targetUrl = `https://xmtp.chat/${this.env}/conversations/${groupId}/manage/members`;
      if (this.page.url() !== targetUrl) {
        await this.page.evaluate((url) => {
          // @ts-expect-error Window access in browser context
          window.history.pushState({}, "", url);
          // @ts-expect-error Window access in browser context
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, targetUrl);
        await this.page.waitForURL(targetUrl);
      }

      await this.page.getByRole("textbox", { name: "Address" }).fill(address);
      await this.page.getByRole("button", { name: "Add" }).click();
      await this.page.getByRole("button", { name: "Save" }).click();
      console.debug("Added member to group");
      return;
    } catch (error) {
      await this.takeSnapshot(`addMemberToGroup-error-${groupId}`);
      throw error;
    }
  }

  public async newGroupFromUI(
    addresses: string[],
    wait = true,
  ): Promise<string> {
    try {
      if (!this.page) throw new Error("Page is not initialized");

      // Navigate using client-side routing instead of page reload
      const targetUrl = `https://xmtp.chat/${this.env}/conversations/new-group`;
      if (this.page.url() !== targetUrl) {
        await this.page.evaluate((url) => {
          // @ts-expect-error Window access in browser context
          window.history.pushState({}, "", url);
          // @ts-expect-error Window access in browser context
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, targetUrl);
        await this.page.waitForURL(targetUrl);
      }

      await this.page.getByRole("button", { name: "Members" }).click();

      const addressInput = this.page.getByRole("textbox", { name: "Address" });
      for (const address of addresses) {
        await addressInput.fill(address);
        await this.page.getByRole("button", { name: "Add" }).click();
      }

      await this.page.getByRole("button", { name: "Create" }).click();
      if (wait) {
        await addressInput.waitFor({ state: "hidden" });
        const url = this.page.url();
        const groupId = url.split("/conversations/")[1];
        console.debug("Created group with ID:", groupId);
        return groupId;
      }
      return "";
    } catch (error) {
      await this.takeSnapshot("newGroupFromUI-error");
      throw error;
    }
  }

  /**
   * Fills addresses and creates a new conversation
   */
  public async newDmFromUI(address: string, wait = true): Promise<string> {
    try {
      if (!this.page) throw new Error("Page is not initialized");
      console.debug("Navigating to new DM");

      // Navigate using client-side routing instead of page reload
      const targetUrl = `https://xmtp.chat/${this.env}/conversations/new-dm`;
      if (this.page.url() !== targetUrl) {
        await this.page.evaluate((url) => {
          // @ts-expect-error Window access in browser context
          window.history.pushState({}, "", url);
          // @ts-expect-error Window access in browser context
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, targetUrl);
        await this.page.waitForURL(targetUrl);
      }

      console.debug("Filling address");
      const addressInput = this.page.getByRole("textbox", { name: "Address" });
      await addressInput.waitFor({ state: "visible" });
      console.debug("Filled address");
      await addressInput.fill(address);
      console.debug("Clicked create");
      await this.page.getByRole("button", { name: "Create" }).click();
      if (wait) {
        await addressInput.waitFor({ state: "hidden" });
        await this.page.waitForURL(/\/conversations\/.+/);
        const url = this.page.url();
        const conversationId = url.split("/conversations/")[1];
        console.debug("Created DM with ID:", conversationId);
        return conversationId;
      }
      return "";
    } catch (error) {
      await this.takeSnapshot(`newDmFromUI-error-${address}`);
      throw error;
    }
  }
  /**
   * Sends a message in the current conversation
   */
  public async sendMessage(message: string): Promise<void> {
    try {
      if (!this.page) throw new Error("Page is not initialized");

      // Wait for the textbox to be visible
      const messageInput = this.page.getByRole("textbox", {
        name: "Type a message...",
      });
      await messageInput.waitFor({ state: "visible" });
      await this.page.waitForTimeout(streamColdStartTimeout);

      console.debug("Filling message");
      await messageInput.fill(message);

      console.debug("Sending message", message);
      await this.page.getByRole("button", { name: "Send" }).click();
    } catch (error) {
      await this.takeSnapshot(`sendMessage-error-${message.slice(0, 20)}`);
      throw error;
    }
  }

  /**
   * Waits for a response matching the expected message(s)
   */
  public async waitForNewConversation(groupName: string): Promise<boolean> {
    try {
      if (!this.page) throw new Error("Page is not initialized");
      for (let i = 0; i < browserTimeout / 1000; i++) {
        await this.page.waitForTimeout(1000);
        const responseText = await this.getLatestGroupFromList();
        console.debug(`Latest group: "${responseText}"`);
        if (responseText.includes(groupName)) {
          return true;
        }
        console.debug(`No response found after ${i + 1} checks`);
      }
      return false;
    } catch (error) {
      await this.takeSnapshot(`waitForNewConversation-error-${groupName}`);
      throw error;
    }
  }
  private async getLatestGroupFromList(): Promise<string> {
    if (!this.page) throw new Error("Page is not initialized");

    const messageItems = await this.page
      .getByRole("navigation")
      .getByTestId("virtuoso-item-list")
      .locator("div")
      .all();

    if (messageItems.length === 0) return "";
    console.debug(`Found ${messageItems.length} conversation items`);
    const latestMessageElement = messageItems[0];
    const responseText = (await latestMessageElement.textContent()) || "";
    console.debug(`Latest conversation: "${responseText}"`);

    return responseText;
  }

  /**
   * Waits for a response matching the expected message(s)
   */
  public async waitForResponse(expectedMessage: string[]): Promise<boolean> {
    try {
      if (!this.page) throw new Error("Page is not initialized");

      for (let i = 0; i < browserTimeout / 1000; i++) {
        await this.page.waitForTimeout(1000);
        const responseText = await this.getLatestMessageText();

        if (
          expectedMessage.some((phrase) =>
            responseText.toLowerCase().includes(phrase.toLowerCase()),
          )
        ) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.debug(`Error in waitForResponse:`, error);
      await this.takeSnapshot(
        `waitForResponse-error-${expectedMessage.join("-")}`,
      );
      throw error;
    }
  }

  /**
   * Gets the text of the latest message in the conversation
   */
  private async getLatestMessageText(): Promise<string> {
    if (!this.page) throw new Error("Page is not initialized");

    // Try multiple selector strategies
    let messageItems: any[] = [];

    try {
      // Strategy 1: Original selector
      messageItems = await this.page
        .getByRole("main")
        .getByTestId("virtuoso-item-list")
        .locator("div")
        .locator("div.mantine-Stack-root")
        .all();
    } catch {
      // Strategy 1 failed, try Strategy 2
    }

    if (messageItems.length === 0) {
      try {
        // Strategy 2: Try without mantine-Stack-root
        messageItems = await this.page
          .getByRole("main")
          .getByTestId("virtuoso-item-list")
          .locator("div")
          .all();
      } catch {
        // Strategy 2 failed, try Strategy 3
      }
    }

    if (messageItems.length === 0) {
      try {
        // Strategy 3: Try finding any message-like elements
        messageItems = await this.page
          .getByRole("main")
          .locator(
            '[data-testid*="message"], [class*="message"], [class*="Message"]',
          )
          .all();
      } catch {
        // All strategies failed
      }
    }

    if (messageItems.length === 0) {
      await this.debugMessageList();
      return "";
    }

    // Iterate backwards through messages to find one with actual content
    let responseText = "";

    for (let i = messageItems.length - 1; i >= 0; i--) {
      const messageElement = messageItems[i];
      const fullText = (await messageElement.textContent()) || "";

      // Try to extract message content, excluding addresses
      const cleanedText = fullText
        .replace(/0x[a-fA-F0-9]{4,}\.\.\.[a-fA-F0-9]{4}/g, "") // Remove truncated addresses
        .replace(/0x[a-fA-F0-9]{40,}/g, "") // Remove full addresses
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

      // If we have meaningful content (more than just whitespace/addresses)
      if (cleanedText.length > 3) {
        // Try to find the actual message text within the element
        try {
          // Look for text that's NOT a date/time and NOT an address
          // Try multiple strategies to find message content
          let messageContent: string | null = null;

          // Strategy 1: Get all direct text nodes and child text
          // First, try to get text that's not in nested elements (direct text content)
          const directText = await messageElement
            .evaluate((el: any): string => {
              // Get direct text nodes (not from children)
              // Node.TEXT_NODE = 3
              let text = "";
              for (const node of el.childNodes) {
                if (node.nodeType === 3) {
                  const nodeText = node.textContent;
                  if (nodeText) {
                    text += String(nodeText).trim() + " ";
                  }
                }
              }
              return text.trim();
            })
            .catch(() => null);

          if (
            directText &&
            typeof directText === "string" &&
            directText.length > 2 &&
            !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(directText) &&
            !/^0x/.test(directText)
          ) {
            messageContent = directText;
          } else {
            // Strategy 2: Look for text in specific message content containers
            const allTextElements = await messageElement.locator("*").all();

            for (const elem of allTextElements) {
              const text = await elem.textContent().catch(() => null);
              if (!text || typeof text !== "string") continue;

              const trimmed = text.trim();
              // Skip if it's just a date/time pattern
              if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmed)) continue;
              // Skip if it's just an address
              if (/^0x[a-fA-F0-9]{4,}/.test(trimmed)) continue;
              // Skip if it's just whitespace or very short
              if (trimmed.length < 2) continue;
              // Skip if it contains date/time patterns
              if (/\d{1,2}\/\d{1,2}\/\d{4}.*\d{1,2}:\d{2}:\d{2}/.test(trimmed))
                continue;
              // Skip if it's mostly addresses
              if ((trimmed.match(/0x[a-fA-F0-9]{4,}/g) || []).length > 1)
                continue;

              // This looks like actual message content
              messageContent = trimmed;
              break;
            }
          }

          if (messageContent && messageContent.length > 0) {
            responseText = messageContent;
            break;
          }
        } catch {
          // Continue to next element
        }

        // If no specific content found, try to extract from cleaned text
        // Remove date/time patterns and addresses
        const finalCleaned = cleanedText
          .replace(
            /\d{1,2}\/\d{1,2}\/\d{4}.*\d{1,2}:\d{2}:\d{2}\s*(AM|PM)/gi,
            "",
          )
          .replace(/0x[a-fA-F0-9]{4,}\.\.\.[a-fA-F0-9]{4}/g, "")
          .trim();

        if (!responseText && finalCleaned.length > 2) {
          responseText = finalCleaned;
          break;
        }
      }
    }

    // If still no text found, use the last element's full text
    if (!responseText && messageItems.length > 0) {
      const latestMessageElement = messageItems[messageItems.length - 1];
      responseText = (await latestMessageElement.textContent()) || "";
    }

    return responseText;
  }

  /**
   * Checks if browser is already initialized
   */
  isInitialized(): boolean {
    return !!(this.browser && this.page);
  }

  /**
   * Starts a new page with the specified options
   */
  async startPage(): Promise<BrowserSession> {
    try {
      if (this.browser && this.page) {
        console.debug("Reusing existing browser instance");
        return { browser: this.browser, page: this.page };
      }
      console.debug(
        `Creating new browser instance (headless: ${this.isHeadless})`,
      );
      const browser = await chromium.launch({
        headless: this.isHeadless,
        slowMo: this.isHeadless ? 0 : 100,
      });
      console.debug(
        `Browser launched successfully in ${this.isHeadless ? "headless" : "visible"} mode`,
      );

      const context: BrowserContext = await browser.newContext(
        this.isHeadless ? {} : { viewport: { width: 1280, height: 720 } },
      );

      const page = await context.newPage();

      await this.setLocalStorage(
        page,
        this.defaultUser.walletKey,
        this.defaultUser.dbEncryptionKey,
      );

      const url = `https://xmtp.chat/${this.env}`;

      console.debug("Navigating to:", url);
      await page.goto(url);
      await page.getByRole("button", { name: "Connect" }).last().click();
      console.debug("Clicked connect button");
      await page.getByRole("button", { name: "I understand" }).click();

      console.debug("Logged in successfully");
      this.page = page;
      this.browser = browser;
      return { browser, page };
    } catch (error) {
      await this.takeSnapshot("startPage-error");
      throw error;
    }
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
