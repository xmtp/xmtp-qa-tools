import { describe, test, expect } from "vitest";
import { runAgent } from "../src/lib/xmtp";

describe("Encryption Tests", () => {
  test("decrypts a message with shared secret in metadata", async () => {
    const agentA = await runAgent({
      name: "bob1",
    });
    const agentB = await runAgent({
      name: "alice1",
    });
    console.log("agentA", agentA.address);
    console.log("agentB", agentB.address);
    const message = "Hello, World!";
    const { nonce, ciphertext } = await agentA.encrypt(
      message,
      agentB.address as string,
    );
    console.log("message", message);
    console.log("nonce", nonce);
    console.log("ciphertext", ciphertext);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    const decryptedMessage = await agentB.decrypt(
      nonce,
      ciphertext,
      agentA.address as string,
    );
    console.log("decryptedMessage", decryptedMessage);

    expect(decryptedMessage).toBe(message);
  }, 1000000);
});
