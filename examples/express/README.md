# E2EE with XMTP Handshake

> [!WARNING]
> This is a proof of concept and is not officially supported by XMTP protocol.

XMTP assists in verifying identities and establishing the initial handshake to share the shared secret. Afterward, you manage **end-to-end encryption** independently, ensuring complete privacy by never exposing plaintext messages outside your environment.

1. **Use XMTP** network only once to exchange a shared secret. You only need to know the sender/reciever xmtp address (evm).
2. **Encrypt** messages locally with [`@xmtp/agent-starter`](https://github.com/xmtp-labs/agent-starter).
3. **Send** only `nonce` + `ciphertext` across your own servers, **no plaintext** ever leaves your app.
4. **Decrypt**: Recive the message using a standard web2 API and decrypt it.

Below is a simple example using Node.js and Express to demonstrate the encryption and decryption process.

## Sending encrypted message

#### Create XMTP client

```javascript
import { xmtpClient } from "@xmtp/agent-starter";

async function main() {
  const agentA = await xmtpClient({ name: "bob" });
  // ...
}
```

Agent A encrypts a message intended for Agent B.

```tsx
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
```

- **agentA.encrypt**: This function encrypts the plaintext message "Hello from A!" using Agent B's address.
- **nonce**: A unique number used once to ensure that the same plaintext will encrypt to different ciphertexts each time.
- **ciphertext**: The encrypted version of the message that can be safely sent over the network.

### Decrypting message

#### Create XMTP client

```javascript
import { xmtpClient } from "@xmtp/agent-starter";

async function main() {
  const agentB = await xmtpClient({ name: "bob" });
  // ...
}
```

Agent B decrypts the received message.

```javascript
appB.post("/receive", async (req, res) => {
  const { nonce, ciphertext, fromAddress } = req.body;
  const msg = await agentB.decrypt(nonce, ciphertext, fromAddress);
  console.log("B decrypted:", msg);
  res.json({ success: true });
});
```

- **agentB.decrypt**: This function takes the `nonce`, `ciphertext`, and the sender's address (`fromAddress`) as inputs to decrypt the message.
- **msg**: The decrypted plaintext message that was originally sent by Agent A.

### Summary

This example demonstrates a simple proof of concept for end-to-end encryption using XMTP. It sets up two agents and two servers, encrypts a message, and sends it securely from one agent to another. The servers handle the decryption of received messages.
