import express from "express";
import fetch from "node-fetch";
import { runAgent, XMTP } from "@xmtp/agent-starter";

async function createServer(port: number, agent: XMTP) {
  const app = express();
  app.use(express.json());

  // Endpoint to RECEIVE encrypted messages
  app.post("/receive", async (req, res) => {
    try {
      const { nonce, ciphertext, fromAddress } = req.body;
      const decryptedMessage = await agent.decrypt(
        nonce,
        ciphertext,
        fromAddress,
      );

      console.log(`Server on port ${port} decrypted:`, decryptedMessage);
      return res.json({ success: true, decryptedMessage });
    } catch (error) {
      console.error("Error in /receive:", error);
      return res.status(500).json({ error: (error as Error).message });
    }
  });

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Server on port ${port} is running...`);
      resolve(server);
    });
  });
}

async function main() {
  // 1. Initialize both agents
  const agentA = await runAgent({
    name: "bob",
  });
  const agentB = await runAgent({
    name: "alice",
  });

  // If the above logs show `undefined`, check if the library uses a different property
  // or if you need to call something like `await agentA.init()` or `agentA.wallet.address`.

  // 3. Start servers
  await createServer(3000, agentA);
  await createServer(3001, agentB);

  // 4. Give a moment for servers to start
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 5. Encrypt + send messages
  try {
    // A -> B: We encrypt for agentB.address
    const msgA = "Hello from Agent A!";
    console.log("msgA =", msgA);
    console.log("agentB.address =", agentB.address);
    const { nonce, ciphertext } = await agentA.encrypt(
      msgA,
      agentB.address as string,
    );
    console.log("Sent to B:", { nonce, ciphertext });
    const response = await fetch("http://localhost:3001/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nonce: nonce as string,
        ciphertext: ciphertext as string,
        fromAddress: agentA.address as string, // the "sender"
      }),
    });
    const result = await response.json();
    console.log("A -> B result:", result);
  } catch (error) {
    console.error("Error sending message from A->B:", (error as Error).message);
  }
}

main().catch(console.error);
