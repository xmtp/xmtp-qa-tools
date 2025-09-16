import { createRemoteAttachmentFromData } from "@bots/utils/atttachment";
import { USDCHandler } from "@bots/utils/usdc";
import { ContentTypeMarkdown } from "@xmtp/content-type-markdown";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import { RemoteAttachmentCodec } from "@xmtp/content-type-remote-attachment";
import { ContentTypeReply, type Reply } from "@xmtp/content-type-reply";
import { WalletSendCallsCodec } from "@xmtp/content-type-wallet-send-calls";

export class UxHandlers {
  private usdcHandler: USDCHandler;

  constructor() {
    this.usdcHandler = new USDCHandler("base-sepolia");
  }

  async handleUxAttachment(ctx: any): Promise<void> {
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
      await ctx.conversation.send(remoteAttachment, {
        contentType: new RemoteAttachmentCodec().contentType,
      });

      await ctx.conversation.send(
        "✅ Real image attachment sent successfully!",
      );
      console.log("📎 Sent real image attachment");
    } catch (error) {
      console.error("❌ Error sending real attachment:", error);
      await ctx.conversation.send("❌ Failed to send real attachment");
    }
  }

  async handleUxMarkdown(ctx: any): Promise<void> {
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

      await ctx.conversation.send(markdownContent, {
        contentType: ContentTypeMarkdown,
        contentFallback:
          "🎨 Markdown Demo\n\nThis is a markdown formatted message demonstrating various formatting options including text formatting, lists, code blocks, links, blockquotes, and tables. This demonstrates the full power of markdown formatting in XMTP messages!",
      });

      await ctx.conversation.send(
        "✅ Markdown message sent successfully! Check how it renders in your client.",
      );
      console.log("Sent comprehensive markdown demo");
    } catch (error) {
      console.error("Error sending markdown demo:", error);
      await ctx.conversation.send("❌ Failed to send markdown demo");
    }
  }

  async handleUxTextReplyReaction(ctx: any): Promise<void> {
    try {
      // First, send a text message
      const textMessage = await ctx.conversation.send(
        "📝 This is a text message that will be replied to and reacted to!",
      );
      console.log("Sent text message for basics demo");

      // Small delay to ensure message is processed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send a markdown message
      const markdownContent = `# 🎨 Markdown Message

This is a **markdown formatted** message with:

- **Bold text**
- *Italic text*
- \`Code snippets\`
- [Links](https://xmtp.org)

> This demonstrates rich text formatting!`;

      await ctx.conversation.send(markdownContent, {
        contentType: ContentTypeMarkdown,
        contentFallback:
          "🎨 Markdown Message\n\nThis is a markdown formatted message with bold text, italic text, code snippets, and links. This demonstrates rich text formatting!",
      });
      console.log("Sent markdown message");

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Then send a reply to the original text message
      const replyContent: Reply = {
        reference: textMessage.id,
        content: "💬 This is a reply to the text message!",
        contentType: ContentTypeReply,
      };

      await ctx.conversation.send(replyContent, ContentTypeReply);
      console.log("Sent reply to text message");

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Finally, send a reaction to the same text message
      const reactionContent = {
        reference: textMessage.id,
        action: "added",
        schema: "unicode",
        content: "👍",
      };

      await ctx.conversation.send(reactionContent, {
        contentType: new ReactionCodec().contentType,
      });

      await ctx.conversation.send(
        "✅ Successfully sent text, markdown, reply, and reaction messages!",
      );
      console.log("Sent reaction to text message");
    } catch (error) {
      console.error("Error in basics demo:", error);
      await ctx.conversation.send("❌ Failed to complete basics demo");
    }
  }

  async handleUxUsdc(ctx: any): Promise<void> {
    try {
      await ctx.conversation.send("💰 Preparing USDC transaction...");

      // For demo, using a mock address
      const mockSenderAddress = "0x1234567890123456789012345678901234567890";
      const recipientAddress = "0x0987654321098765432109876543210987654321";
      const amount = 1000000; // 1 USDC (6 decimals)

      // Create USDC transfer calls using the utility
      const transferCalls = this.usdcHandler.createUSDCTransferCalls(
        mockSenderAddress,
        recipientAddress,
        amount,
      );

      // Send the wallet send calls
      await ctx.conversation.send(transferCalls, {
        contentType: new WalletSendCallsCodec().contentType,
      });

      await ctx.conversation.send(
        `✅ USDC transaction request sent!\n` +
          `💰 Amount: ${amount / 1000000} USDC\n` +
          `📍 Network: ${this.usdcHandler.getNetworkConfig().networkName}\n` +
          `🎯 To: ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`,
      );

      console.log("💰 Sent USDC transaction request:", {
        amount: amount / 1000000,
        network: this.usdcHandler.getNetworkConfig().networkName,
        to: recipientAddress,
      });
    } catch (error) {
      console.error("❌ Error sending USDC transaction:", error);
      await ctx.conversation.send("❌ Failed to send USDC transaction");
    }
  }
}
