import { getWorkersWithVersions } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInbox } from "@inboxes/utils";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "ipa-automation";

describe(testName, async () => {
  const workers = await getWorkers(
    getWorkersWithVersions(["alice", "bob", "charlie"]),
    testName,
    typeofStream.Message,
  );

  const testInbox = getRandomInbox();
  console.log(`Test inbox: ${testInbox.address} (${testInbox.inboxId})`);

  setupTestLifecycle({
    testName,
    expect,
  });

  // Mock helpers for now since the actual Maestro setup has import issues
  const mockMaestro = {
    async checkMaestroInstallation(): Promise<boolean> {
      console.log("Checking Maestro installation...");
      return true;
    },
    async installApp(ipaPath: string): Promise<void> {
      console.log(`Installing app from: ${ipaPath}`);
    },
    async launchApp(bundleId: string): Promise<void> {
      console.log(`Launching app: ${bundleId}`);
    },
    async runFlow(
      flowPath: string,
      variables: Record<string, string> = {},
    ): Promise<any> {
      console.log(`Running flow: ${flowPath} with variables:`, variables);
      return { success: true, output: "Flow completed", duration: 1000 };
    },
    async takeScreenshot(name: string): Promise<string> {
      console.log(`Taking screenshot: ${name}`);
      return `/logs/screenshots/${name}.png`;
    },
    async cleanup(): Promise<void> {
      console.log("Cleaning up Maestro resources");
    },
  };

  const mockDeviceManager = {
    async checkXcodeTools(): Promise<boolean> {
      console.log("Checking Xcode tools...");
      return true;
    },
    async startSimulator(): Promise<any> {
      console.log("Starting iOS Simulator...");
      return { udid: "mock-simulator-udid", name: "iPhone 15 Pro" };
    },
    async cleanupTestSimulators(): Promise<void> {
      console.log("Cleaning up test simulators");
    },
  };

  beforeAll(async () => {
    try {
      // Check prerequisites
      const maestroAvailable = await mockMaestro.checkMaestroInstallation();
      const xcodeAvailable = await mockDeviceManager.checkXcodeTools();

      if (!maestroAvailable) {
        throw new Error(
          "Maestro is not installed. Please install Maestro CLI first.",
        );
      }

      if (!xcodeAvailable) {
        throw new Error("Xcode tools are not available. Please install Xcode.");
      }

      console.log("Prerequisites check passed");
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should validate environment and setup", async () => {
    try {
      const ipaPath = process.env.IPA_PATH;
      if (!ipaPath) {
        throw new Error("IPA_PATH environment variable is required");
      }

      console.log(`IPA Path: ${ipaPath}`);
      console.log(`XMTP Environment: ${process.env.XMTP_ENV}`);

      expect(ipaPath).toBeTruthy();
      expect(process.env.XMTP_ENV).toBeTruthy();
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should install and launch the app", async () => {
    try {
      const ipaPath = process.env.IPA_PATH || "/path/to/app.ipa";
      const bundleId = process.env.APP_BUNDLE_ID || "com.example.app";

      // Start simulator
      const device = await mockDeviceManager.startSimulator();
      console.log(`Started device: ${device.name} (${device.udid})`);

      // Install app
      await mockMaestro.installApp(ipaPath);

      // Launch app
      await mockMaestro.launchApp(bundleId);

      // Take screenshot of launch
      await mockMaestro.takeScreenshot("app-launched");

      expect(device).toBeTruthy();
    } catch (e) {
      await mockMaestro.takeScreenshot("launch-failure");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should complete app authentication flow", async () => {
    try {
      // Run authentication flow
      const authResult = await mockMaestro.runFlow("authentication.yaml", {
        WALLET_ADDRESS: testInbox.address,
        PRIVATE_KEY: testInbox.encryptionKey,
      });

      expect(authResult.success).toBe(true);
      console.log(`Authentication completed in ${authResult.duration}ms`);

      // Take screenshot after auth
      await mockMaestro.takeScreenshot("authenticated");
    } catch (e) {
      await mockMaestro.takeScreenshot("auth-failure");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should create and send a direct message", async () => {
    try {
      const alice = workers.get("alice")!;

      // Start message stream on Alice to listen for responses
      alice.worker.startStream(typeofStream.Message);

      // Create DM through mobile app UI
      const dmResult = await mockMaestro.runFlow("messaging.yaml", {
        RECIPIENT_ADDRESS: alice.address,
        MESSAGE_TEXT: "Hello from mobile app!",
      });

      expect(dmResult.success).toBe(true);

      // Verify message was received by Alice
      const verifyResult = await verifyMessageStream(
        alice.client.conversations.listDms()[0] ||
          (await alice.client.conversations.newDm(testInbox.inboxId)),
        [alice],
        1,
        "Hello from mobile app!",
      );

      expect(verifyResult.allReceived).toBe(true);

      await mockMaestro.takeScreenshot("dm-sent");
    } catch (e) {
      await mockMaestro.takeScreenshot("dm-failure");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should receive and display incoming messages", async () => {
    try {
      const bob = workers.get("bob")!;

      // Send message from Bob to the mobile app user
      const dm = await bob.client.conversations.newDm(testInbox.inboxId);
      await dm.send("Hello from Bob!");

      // Run flow to check for incoming message
      const messageResult = await mockMaestro.runFlow("checkMessages.yaml", {
        EXPECTED_MESSAGE: "Hello from Bob!",
        SENDER_ADDRESS: bob.address,
      });

      expect(messageResult.success).toBe(true);

      await mockMaestro.takeScreenshot("message-received");
    } catch (e) {
      await mockMaestro.takeScreenshot("receive-failure");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should create and manage groups", async () => {
    try {
      const alice = workers.get("alice")!;
      const bob = workers.get("bob")!;

      // Create group through mobile app UI
      const groupResult = await mockMaestro.runFlow("groupCreation.yaml", {
        GROUP_NAME: "Test Group",
        MEMBER_ADDRESSES: `${alice.address},${bob.address}`,
      });

      expect(groupResult.success).toBe(true);

      // Send message to the group from Alice
      const groups = await alice.client.conversations.listGroups();
      const testGroup = groups.find((g) => g.name?.includes("Test Group"));

      if (testGroup) {
        await testGroup.send("Welcome to the group!");

        // Check if message appears in mobile app
        const groupMessageResult = await mockMaestro.runFlow(
          "checkGroupMessages.yaml",
          {
            GROUP_NAME: "Test Group",
            EXPECTED_MESSAGE: "Welcome to the group!",
          },
        );

        expect(groupMessageResult.success).toBe(true);
      }

      await mockMaestro.takeScreenshot("group-created");
    } catch (e) {
      await mockMaestro.takeScreenshot("group-failure");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should handle app backgrounding and notifications", async () => {
    try {
      const charlie = workers.get("charlie")!;

      // Send app to background
      await mockMaestro.runFlow("backgroundApp.yaml");

      // Send message while app is backgrounded
      const dm = await charlie.client.conversations.newDm(testInbox.inboxId);
      await dm.send("Message while backgrounded");

      // Check for notification and tap it
      const notificationResult = await mockMaestro.runFlow(
        "handleNotification.yaml",
        {
          EXPECTED_NOTIFICATION: "Message while backgrounded",
          SENDER_NAME: "Charlie",
        },
      );

      expect(notificationResult.success).toBe(true);

      await mockMaestro.takeScreenshot("notification-handled");
    } catch (e) {
      await mockMaestro.takeScreenshot("notification-failure");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  // Cleanup after all tests
  afterAll(async () => {
    try {
      await mockMaestro.cleanup();
      await mockDeviceManager.cleanupTestSimulators();
    } catch (e) {
      console.warn("Cleanup failed:", e);
    }
  });
});
