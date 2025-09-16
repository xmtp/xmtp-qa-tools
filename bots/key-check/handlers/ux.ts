import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createRemoteAttachmentFromData,
  createRemoteAttachmentFromFile,
  encryptAttachment,
} from "@bots/utils/atttachment";
import { USDCHandler } from "@bots/utils/usdc";
import { type MessageContext } from "@xmtp/agent-sdk";
import { ContentTypeMarkdown } from "@xmtp/content-type-markdown";
import {
  ContentTypeReaction,
  type Reaction,
} from "@xmtp/content-type-reaction";
import { ContentTypeRemoteAttachment } from "@xmtp/content-type-remote-attachment";
import { ContentTypeReply, type Reply } from "@xmtp/content-type-reply";
import { ContentTypeText } from "@xmtp/content-type-text";
import { ContentTypeWalletSendCalls } from "@xmtp/content-type-wallet-send-calls";
import axios from "axios";
import FormData from "form-data";

const DEFAULT_IMAGE_PATH = "./logo.png";
const PINATA_API_KEY = process.env.PINATA_API_KEY || "";
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || "";

export class UxHandlers {
  private usdcHandler: USDCHandler;

  constructor() {
    this.usdcHandler = new USDCHandler("base-sepolia");
  }

  async handleUxAttachment(ctx: MessageContext): Promise<void> {
    try {
      const senderAddress = await ctx.getSenderAddress();

      console.log(`Preparing attachment for ${senderAddress}...`);
      await ctx.conversation.send(`I'll send you an attachment now...`);

      const encrypted = await encryptAttachment(
        new Uint8Array(await readFile(DEFAULT_IMAGE_PATH)),
        "logo.png",
        "image/png",
      );
      const fileUrl = await uploadToPinata(
        encrypted.encryptedData,
        encrypted.filename,
      );

      const remoteAttachment = await createRemoteAttachmentFromFile(
        DEFAULT_IMAGE_PATH,
        fileUrl,
        "image/png",
      );
      await ctx.conversation.send(
        remoteAttachment,
        ContentTypeRemoteAttachment,
      );

      console.log("Remote attachment sent successfully");
    } catch (error) {
      console.error("❌ Error sending real attachment:", error);
      await ctx.conversation.send("❌ Failed to send real attachment");
    }
  }

  async handleUxMarkdown(ctx: MessageContext): Promise<void> {
    try {
      const markdownContent = `# 🎨 Markdown Demo

This is a **markdown formatted** message demonstrating various formatting options:

## Text Formatting
- **Bold text** for emphasis
- *Italic text* for subtle emphasis
- \`Inline code\` for technical terms
- ~~Strikethrough~~ for corrections

## Lists
### Unordered List
- First item
- Second item
  - Nested item
  - Another nested item
- Third item

### Ordered List
1. First step
2. Second step
3. Third step

## Code Blocks
\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Links and References
- [XMTP Documentation](https://docs.xmtp.org)
- [XMTP GitHub](https://github.com/xmtp)

## Blockquotes
> This is a blockquote demonstrating how to highlight important information or quotes.

## Tables
| Feature | Status | Description |
|---------|--------|-------------|
| Text | ✅ | Basic text messages |
| Markdown | ✅ | Rich text formatting |
| Reactions | ✅ | Emoji reactions |
| Replies | ✅ | Threaded conversations |

---

**This demonstrates the full power of markdown formatting in XMTP messages!**`;

      await ctx.conversation.send(markdownContent, ContentTypeMarkdown);

      await ctx.conversation.send(
        "✅ Markdown message sent successfully! Check how it renders in your client.",
      );
      console.log("Sent comprehensive markdown demo");
    } catch (error) {
      console.error("Error sending markdown demo:", error);
      await ctx.conversation.send("❌ Failed to send markdown demo");
    }
  }

  async handleBasics(ctx: MessageContext): Promise<void> {
    try {
      // First, send a text message
      const textMessage = await ctx.conversation.send(
        "📝 This is a text message that will be replied to and reacted to!",
      );
      console.log("Sent text message for basics demo", textMessage);

      // Step 1: Add thinking emoji reaction
      await ctx.conversation.send(
        {
          action: "added",
          content: "❤️",
          reference: textMessage,
          schema: "shortcode",
        } as Reaction,
        ContentTypeReaction,
      );

      await ctx.conversation.send(
        {
          reference: textMessage,
          contentType: ContentTypeText,
          content: "💬 This is a reply to the text message!",
        } as Reply,
        ContentTypeReply,
      );
      console.log("Sent reply to text message");
    } catch (error) {
      console.error("Error in basics demo:", error);
      await ctx.conversation.send("❌ Failed to complete basics demo");
    }
  }

  async handleTransaction(ctx: MessageContext): Promise<void> {
    const agentAddress = ctx.client.accountIdentifier?.identifier || "";
    const senderAddress = await ctx.getSenderAddress();

    // Convert amount to USDC decimals (6 decimal places)
    const amountInDecimals = Math.floor(0.1 * Math.pow(10, 6));

    const walletSendCalls = this.usdcHandler.createUSDCTransferCalls(
      senderAddress,
      agentAddress,
      amountInDecimals,
    );
    console.log("Replied with wallet sendcall");
    await ctx.conversation.send(walletSendCalls, ContentTypeWalletSendCalls);
  }
}

export async function uploadToPinata(
  fileData: Uint8Array,
  filename: string,
): Promise<string> {
  console.log(`Uploading ${filename}, size: ${fileData.byteLength} bytes`);

  const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;

  const data = new FormData();
  data.append("file", Buffer.from(fileData), {
    filename,
    contentType: "application/octet-stream",
  });

  // Using type assertion for FormData with _boundary property
  const response = await axios.post(url, data, {
    maxContentLength: Infinity,
    headers: {
      "Content-Type": `multipart/form-data; boundary=${(data as FormData & { _boundary: string })._boundary}`,
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_KEY,
    },
  });

  interface PinataResponse {
    IpfsHash: string;
    PinSize: number;
    Timestamp: string;
  }

  const ipfsHash = (response.data as PinataResponse).IpfsHash;
  const fileUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
  console.log("File URL:", fileUrl);

  return fileUrl;
}
