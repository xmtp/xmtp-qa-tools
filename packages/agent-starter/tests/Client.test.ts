import { generatePrivateKey } from "viem/accounts";
import { describe, expect, test } from "vitest";
import type { Message } from "../src/lib/types";
import { createUser, XMTP, xmtpClient } from "../src/lib/xmtp";

describe("Client Private Key Configuration Tests", () => {
  test("creates a client with a random generated key", async () => {
    const xmtp = new XMTP();
    await xmtp.init();
    expect(xmtp.inboxId).toBeDefined();
  }, 25000); // Added 15 second timeout

  test("creates a client with a provided private key", async () => {
    const walletKey = generatePrivateKey();
    const xmtp = new XMTP({
      walletKey,
      onMessage: async () => {},
    });
    await xmtp.init();
    expect(xmtp.inboxId).toBeDefined();
  }, 15000); // Added 15 second timeout

  test("creates user with valid private key", () => {
    const privateKey = generatePrivateKey();
    const user = createUser(privateKey);

    expect(user.key).toBe(privateKey);
    expect(user.account).toBeDefined();
    expect(user.wallet).toBeDefined();
  }, 15000); // Added 15 second timeout

  test("Creates a key with a agent name", async () => {
    const agentName = "bob1";
    const xmtp = await xmtpClient({
      name: agentName,
    });
    expect(xmtp.inboxId).toBeDefined();
  });

  test("fails gracefully with invalid private key format", async () => {
    const invalidKey = "invalid_key";

    try {
      const xmtp = new XMTP({
        walletKey: invalidKey,
        onMessage: async () => {},
      });
      await xmtp.init();
      // If no error is thrown, fail the test
      throw new Error("Expected error was not thrown");
    } catch (error) {
      // Check if the error is the expected one
      expect((error as Error).message).toContain("invalid private key");
    }
  }, 15000); // Added 15 second timeout

  test("Creates a key with a agent name", async () => {
    const agentName = "bob1";
    const xmtp = await xmtpClient({
      name: agentName,
      onMessage: async (message: Message) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log(
          "message received",
          message.content.text,
          "from",
          message.sender.address,
        );
      },
    });
    const xmtp2 = await xmtpClient({
      name: "alice1",
      onMessage: async (message: Message) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log(
          "message received",
          message.content.text,
          "from",
          message.sender.address,
        );
      },
    });

    const message1 = await xmtp.send({
      message: "Hello, Alice!",
      receivers: [xmtp2.inboxId || ""],
      metadata: {},
    });
    const message2 = await xmtp2.send({
      message: "Hello, Bob!",
      receivers: [xmtp.inboxId || ""],
      metadata: {},
    });

    expect(message1).toBeDefined();
    expect(message2).toBeDefined();
  }, 15000);
});
