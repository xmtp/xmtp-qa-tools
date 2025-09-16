import { createRemoteAttachmentFromData } from "@bots/utils/atttachment";
import { USDCHandler } from "@bots/utils/usdc";
import { type MessageContext } from "@xmtp/agent-sdk";
import { ContentTypeMarkdown } from "@xmtp/content-type-markdown";
import {
  ContentTypeReaction,
  type Reaction,
} from "@xmtp/content-type-reaction";
import { ContentTypeRemoteAttachment } from "@xmtp/content-type-remote-attachment";
import { ContentTypeReply, type Reply } from "@xmtp/content-type-reply";
import { ContentTypeWalletSendCalls } from "@xmtp/content-type-wallet-send-calls";

export class UxHandlers {
  private usdcHandler: USDCHandler;

  constructor() {
    this.usdcHandler = new USDCHandler("base-sepolia");
  }

  async handleUxAttachment(ctx: MessageContext): Promise<void> {
    try {
      await ctx.conversation.send(
        "📎 Preparing to send real image attachment...",
      );

      // Create a simple test image (1x1 pixel PNG)
      const testImageData = new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0,
        1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 12, 73, 68,
        65, 84, 8, 215, 99, 248, 15, 0, 0, 1, 0, 1, 0, 24, 221, 141, 219, 0, 0,
        0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
      ]);

      // For demo purposes, we'll use a mock file URL (in production, you'd upload to a real service)
      const mockFileUrl = "https://example.com/test-image.png";

      // Create remote attachment using the utility
      const remoteAttachment = await createRemoteAttachmentFromData(
        testImageData,
        "test-image.png",
        "image/png",
        mockFileUrl,
      );

      // Send the attachment
      await ctx.conversation.send(
        remoteAttachment,
        ContentTypeRemoteAttachment,
      );

      await ctx.conversation.send(
        "✅ Real image attachment sent successfully!",
      );
      console.log("📎 Sent real image attachment");
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
