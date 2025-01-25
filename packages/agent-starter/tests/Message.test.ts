import { describe, expect, test } from "vitest";
import type { Message } from "../src/lib/types";
import { xmtpClient } from "../src/lib/xmtp";

describe("Client Private Key Configuration Tests", async () => {
  const xmtp = await xmtpClient({
    name: "bob2",
    onMessage: async (message: Message) => {
      console.log(
        "Bob received message:",
        message.content.text,
        "from",
        message.sender.address,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(message.content.text).toBe("Hello, Alice!");
      expect(message.sender.address).toBe(xmtp2.address);
    },
  });
  console.log("Bob's client initialized");

  const xmtp2 = await xmtpClient({
    name: "alice2",
    onMessage: async (message: Message) => {
      console.log(
        "Alice received message:",
        message.content.text,
        "from",
        message.sender.address,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(message.content.text).toBe("Hello, Bob!");
      expect(message.sender.address).toBe(xmtp.address);
    },
  });

  test("Send a message to a client", async () => {
    console.log("Bob's address:", xmtp.address);
    console.log("Alice's address:", xmtp2.address);
    const message = await xmtp.send({
      message: "Hello, Alice!",
      receivers: [xmtp2.address as string],
      metadata: {},
    });
    const message2 = await xmtp2.send({
      message: "Hello, Bob!",
      receivers: [xmtp.address as string],
      metadata: {},
    });
    console.log("Message sent:", message);
    console.log("Message sent:", message2);
  }, 25000);
});
