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
  async createGroupAndReceiveGm(
    addresses: string[],
    expectedResponse?: string | string[],
  ): Promise<void> {
    const { page, browser } = await this.startPage();
    try {
      console.log("Filling addresses and creating group");
      await this.fillAddressesAndCreate(page, addresses);
      const response = await this.sendAndWaitForResponse(
        page,
        "hi",
        expectedResponse || "gm",
      );
      if (!response) {
        throw new Error("Failed to receive response");
      }
    } catch (error) {
      console.error("Error in createGroupAndReceiveGm:", error);
      await this.takeSnapshot(page, "before-finding-gm");
      throw error;
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
      console.log("Waiting for message input to be visible");
      await page
        .getByRole("textbox", { name: "Type a message..." })
        .waitFor({ state: "visible" });
      console.log("Filling message");
      await page
        .getByRole("textbox", { name: "Type a message..." })
        .fill(sendMessage);
      console.log("Sending message", sendMessage);
      await page.waitForTimeout(1000);
      await page.getByRole("button", { name: "Send" }).click();

      // Wait for messages to appear in the virtuoso list
      await page.waitForSelector(
        'div[data-testid="virtuoso-item-list"] > div',
        {
          timeout: defaultValues.streamTimeout,
        },
      );

      // Get initial message count
      const initialMessageCount = await page
        .locator('div[data-testid="virtuoso-item-list"] > div')
        .count();
      console.log(`Initial message count: ${initialMessageCount}`);

      // Wait for new message to appear
      let messageFound = false;
      let responseText = "";

      // Convert expected message to array for consistent handling
      const expectedPhrases = expectedMessage
        ? Array.isArray(expectedMessage)
          ? expectedMessage
          : [expectedMessage]
        : [];

      // Poll for new messages
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(1000);
        const currentMessageCount = await page
          .locator('div[data-testid="virtuoso-item-list"] > div')
          .count();

        if (currentMessageCount > initialMessageCount) {
          // Get the latest message
          const messageItems = await page
            .locator('div[data-testid="virtuoso-item-list"] > div')
            .all();
          const latestMessageElement = messageItems[messageItems.length - 1];

          responseText = (await latestMessageElement.textContent()) || "";
          console.log(`Latest message: "${responseText}"`);

          if (!expectedPhrases.length) {
            // If no expected message, any response is valid
            messageFound = true;
            break;
          } else {
            // Check if any of the expected phrases are in the response
            messageFound = expectedPhrases.some((phrase) =>
              responseText.toLowerCase().includes(phrase.toLowerCase()),
            );

            if (messageFound) break;
          }
        }
      }

      if (messageFound) {
        if (expectedPhrases.length) {
          console.log(
            `Found expected response containing one of [${expectedPhrases.join(", ")}]: "${responseText}"`,
          );
        } else {
          console.log(`Received a response: "${responseText}"`);
        }
      } else {
        if (expectedPhrases.length) {
          console.log(
            `Failed to find response containing any of [${expectedPhrases.join(", ")}]. Last message: "${responseText}"`,
          );
        } else {
          console.log(
            `Failed to receive any response. Last message: "${responseText}"`,
          );
        }
      }

      return messageFound;
    } catch (error) {
      console.error("Error in sendAndWaitForResponse:", error);
      await this.takeSnapshot(page, "before-finding-expected-message");
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
      this.isHeadless ? {} : {},
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
    expectedMessage?: string | string[],
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
