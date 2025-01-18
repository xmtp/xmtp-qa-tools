# E2EE with XMTP Handshake

> [!WARNING]
> This is a proof of concept and is not officially supported by the protocol.

XMTP assists in verifying identities and establishing the initial handshake to share the shared secret. Afterward, you manage **end-to-end encryption** independently, ensuring complete privacy by never exposing plaintext messages outside your environment.

1. **Use XMTP** only once to exchange public addresses.
2. **Encrypt** messages locally with [`@xmtp/agent-starter`](https://github.com/xmtp-labs/agent-starter).
3. **Send** only `nonce` + `ciphertext` across your own servers, **no plaintext** ever leaves your app.

```js
import express from "express";
import fetch from "node-fetch";
import { runAgent } from "@xmtp/agent-starter";

async function main() {
  // 1. Create two agents with different keys (already got addresses from XMTP).
  const agentA = await runAgent({ name: "bob" });
  const agentB = await runAgent({ name: "alice" });

  // 2. Minimal server to receive encrypted data.
  const appA = express();

  appA.use(express.json());

  appA.post("/receive", async (req, res) => {
    const { nonce, ciphertext, fromAddress } = req.body;
    const msg = await agentA.decrypt(nonce, ciphertext, fromAddress);
    console.log("A decrypted:", msg);
    res.json({ success: true });
  });

  appA.listen(3000, () => console.log("Server A on 3000"));

  const appB = express();

  appB.use(express.json());

  appB.post("/receive", async (req, res) => {
    const { nonce, ciphertext, fromAddress } = req.body;
    const msg = await agentB.decrypt(nonce, ciphertext, fromAddress);
    console.log("B decrypted:", msg);
    res.json({ success: true });
  });

  appB.listen(3001, () => console.log("Server B on 3001"));

  // 3. Encrypt a message locally and POST the ciphertext to the other server.
  setTimeout(async () => {
    const { nonce, ciphertext } = await agentA.encrypt(
      "Hello from A!",
      agentB.address,
    );
    await fetch("http://localhost:3001/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nonce, ciphertext, fromAddress: agentA.address }),
    });
  }, 2000);
}

main();
```
