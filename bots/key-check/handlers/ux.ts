import { createRemoteAttachmentFromData } from "@bots/utils/atttachment";
import { USDCHandler } from "@bots/utils/usdc";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import { RemoteAttachmentCodec } from "@xmtp/content-type-remote-attachment";
import { ContentTypeReply, type Reply } from "@xmtp/content-type-reply";
import { WalletSendCallsCodec } from "@xmtp/content-type-wallet-send-calls";

export class UxHandlers {
  private currentActionMessage: any = null;
  private lastMessage: any = null;
  private usdcHandler: USDCHandler;

  constructor() {
    // Initialize USDC handler for Base Sepolia testnet
    this.usdcHandler = new USDCHandler("base-sepolia");
  }

  updateCurrentActionMessage(message: any): void {
    this.currentActionMessage = message;
  }

  updateLastMessage(message: any): void {
    this.lastMessage = message;
  }

  async handleUxHelp(ctx: any, uxHelpText: string): Promise<void> {
    await ctx.conversation.send(uxHelpText);
    console.log("Sent UX demo help information");
  }

  async handleUxReaction(ctx: any): Promise<void> {
    if (!this.currentActionMessage) {
      await ctx.conversation.send(
        "❌ No action message to react to. Use an action button first!",
      );
      return;
    }

    try {
      // Send a reaction to the current action message
      const reactionContent = {
        reference: this.currentActionMessage.id,
        action: "added",
        schema: "unicode",
        content: "👍",
      };

      await ctx.conversation.send(reactionContent, {
        contentType: new ReactionCodec().contentType,
      });

      await ctx.conversation.send(
        "✅ Sent a 👍 reaction to the action message!",
      );
      console.log("Sent reaction to action message");
    } catch (error) {
      console.error("Error sending reaction:", error);
      await ctx.conversation.send("❌ Failed to send reaction");
    }
  }

  async handleUxReply(ctx: any): Promise<void> {
    if (!this.currentActionMessage) {
      await ctx.conversation.send(
        "❌ No action message to reply to. Use an action button first!",
      );
      return;
    }

    try {
      // Send a reply to the current action message
      const replyContent: Reply = {
        reference: this.currentActionMessage.id,
        content: "This is a reply to the action message! 💬",
        contentType: ContentTypeReply,
      };

      await ctx.conversation.send(replyContent, ContentTypeReply);

      console.log("Sent reply to action message");
    } catch (error) {
      console.error("Error sending reply:", error);
      await ctx.conversation.send("❌ Failed to send reply");
    }
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

  async handleUxText(ctx: any): Promise<void> {
    await ctx.conversation.send(
      "📝 This is a regular text message from the Key-Check bot's UX demo!",
    );
    console.log("Sent UX demo text message");
  }

  async handleUxTextReplyReaction(ctx: any): Promise<void> {
    try {
      // First, send a text message
      const textMessage = await ctx.conversation.send(
        "📝 This is a text message that will be replied to and reacted to!",
      );
      console.log("Sent text message for reply/reaction demo");

      // Small delay to ensure message is processed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Then send a reply to that same text message
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
        "✅ Successfully sent text message, reply, and reaction to the same message!",
      );
      console.log("Sent reaction to text message");
    } catch (error) {
      console.error("Error in text+reply+reaction demo:", error);
      await ctx.conversation.send(
        "❌ Failed to complete text+reply+reaction demo",
      );
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

  async handleUxAll(ctx: any): Promise<void> {
    await ctx.conversation.send("🚀 UX Demo: Sending all message types...");

    // 1. Text message
    await ctx.conversation.send("1️⃣ Regular text message");
    console.log("Sent text in demo sequence");

    // Small delay between messages
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Real attachment
    await ctx.conversation.send("2️⃣ Sending real attachment...");
    await this.handleUxAttachment(ctx);
    console.log("Sent real attachment in sequence");

    // Small delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. Reply (if we have an action message to reply to)
    if (this.currentActionMessage) {
      try {
        const replyContent = {
          reference: this.currentActionMessage.id,
          content: "3️⃣ This is a reply to the action message!",
          contentType: ContentTypeReply,
        } as Reply;

        await ctx.conversation.send(replyContent, ContentTypeReply);
        console.log("Sent reply in demo sequence");
      } catch (error) {
        console.error("Error sending reply in sequence:", error);
        await ctx.conversation.send("3️⃣ Reply failed (technical issue)");
      }
    } else {
      await ctx.conversation.send(
        "3️⃣ Reply skipped - no action message to reply to",
      );
    }

    // Small delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. Reaction (if we have an action message to react to)
    if (this.currentActionMessage) {
      try {
        const reactionContent = {
          reference: this.currentActionMessage.id,
          action: "added",
          schema: "unicode",
          content: "🎉",
        };

        await ctx.conversation.send(reactionContent, {
          contentType: new ReactionCodec().contentType,
        });

        await ctx.conversation.send(
          "4️⃣ Sent a 🎉 reaction to the action message!",
        );
        console.log("Sent reaction in demo sequence");
      } catch (error) {
        console.error("Error sending reaction in sequence:", error);
        await ctx.conversation.send("4️⃣ Reaction failed (technical issue)");
      }
    } else {
      await ctx.conversation.send(
        "4️⃣ Reaction skipped - no action message to react to",
      );
    }

    // Small delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 5. USDC Transaction
    await ctx.conversation.send("5️⃣ Sending USDC transaction...");
    await this.handleUxUsdc(ctx);
    console.log("Sent USDC transaction in sequence");

    await ctx.conversation.send(
      "✅ UX Demo complete! All message types demonstrated including real attachment and USDC transaction.",
    );
    console.log("Completed UX demo sequence");
  }
}
