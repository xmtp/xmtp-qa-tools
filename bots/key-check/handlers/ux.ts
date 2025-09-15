import { ReactionCodec } from "@xmtp/content-type-reaction";
import { ReplyCodec } from "@xmtp/content-type-reply";

export class UxHandlers {
  private lastReceivedMessage: any = null;

  // Update the last received message for UX demo functionality
  updateLastMessage(message: any): void {
    this.lastReceivedMessage = message;
  }

  async handleUxHelp(ctx: any, uxHelpText: string): Promise<void> {
    await ctx.conversation.send(uxHelpText);
    console.log("Sent UX demo help information");
  }

  async handleUxReaction(ctx: any): Promise<void> {
    if (!this.lastReceivedMessage) {
      await ctx.conversation.send(
        "❌ No message to react to. Send a message first!",
      );
      return;
    }

    try {
      // Send a reaction to the last message
      const reactionContent = {
        reference: this.lastReceivedMessage.id,
        action: "added",
        schema: "unicode",
        content: "👍",
      };

      await ctx.conversation.send(reactionContent, {
        contentType: new ReactionCodec().contentType,
      });

      await ctx.conversation.send(
        "✅ Sent a 👍 reaction to your last message!",
      );
      console.log("Sent reaction");
    } catch (error) {
      console.error("Error sending reaction:", error);
      await ctx.conversation.send("❌ Failed to send reaction");
    }
  }

  async handleUxReply(ctx: any): Promise<void> {
    if (!this.lastReceivedMessage) {
      await ctx.conversation.send(
        "❌ No message to reply to. Send a message first!",
      );
      return;
    }

    try {
      // Send a reply to the last message
      const replyContent = {
        reference: this.lastReceivedMessage.id,
        content: "This is a reply to your message! 💬",
      };

      await ctx.conversation.send(replyContent, {
        contentType: new ReplyCodec().contentType,
      });

      console.log("Sent reply");
    } catch (error) {
      console.error("Error sending reply:", error);
      await ctx.conversation.send("❌ Failed to send reply");
    }
  }

  async handleUxAttachment(ctx: any): Promise<void> {
    // Note: Real attachment implementation would require RemoteAttachmentCodec
    // and proper file handling. This is a demonstration.
    const attachmentDemo =
      "📎 Attachment Demo\n\n" +
      "This would send an attachment if properly configured.\n" +
      "XMTP attachments require:\n" +
      "• RemoteAttachmentCodec\n" +
      "• File upload service\n" +
      "• Proper content encryption\n\n" +
      "See: https://github.com/ephemeraHQ/xmtp-agent-examples/tree/agent-sdk/examples/xmtp-attachments";

    await ctx.conversation.send(attachmentDemo);
    console.log("Sent attachment demo message");
  }

  async handleUxText(ctx: any): Promise<void> {
    await ctx.conversation.send(
      "📝 This is a regular text message from the Key-Check bot's UX demo!",
    );
    console.log("Sent UX demo text message");
  }

  async handleUxAll(ctx: any): Promise<void> {
    await ctx.conversation.send("🚀 UX Demo: Sending all message types...");

    // 1. Text message
    await ctx.conversation.send("1️⃣ Regular text message");
    console.log("Sent text in demo sequence");

    // Small delay between messages
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Attachment demo
    await ctx.conversation.send(
      "2️⃣ Attachment demo - See https://github.com/ephemeraHQ/xmtp-agent-examples/tree/agent-sdk/examples/xmtp-attachments for implementation",
    );
    console.log("Sent attachment demo in sequence");

    // Small delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. Reply (if we have a message to reply to)
    if (this.lastReceivedMessage) {
      try {
        const replyContent = {
          reference: this.lastReceivedMessage.id,
          content: "3️⃣ This is a reply message!",
        };

        await ctx.conversation.send(replyContent, {
          contentType: new ReplyCodec().contentType,
        });
        console.log("Sent reply in demo sequence");
      } catch (error) {
        console.error("Error sending reply in sequence:", error);
        await ctx.conversation.send("3️⃣ Reply failed (technical issue)");
      }
    } else {
      await ctx.conversation.send("3️⃣ Reply skipped - no message to reply to");
    }

    // Small delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. Reaction (if we have a message to react to)
    if (this.lastReceivedMessage) {
      try {
        const reactionContent = {
          reference: this.lastReceivedMessage.id,
          action: "added",
          schema: "unicode",
          content: "🎉",
        };

        await ctx.conversation.send(reactionContent, {
          contentType: new ReactionCodec().contentType,
        });

        await ctx.conversation.send("4️⃣ Sent a 🎉 reaction!");
        console.log("Sent reaction in demo sequence");
      } catch (error) {
        console.error("Error sending reaction in sequence:", error);
        await ctx.conversation.send("4️⃣ Reaction failed (technical issue)");
      }
    } else {
      await ctx.conversation.send(
        "4️⃣ Reaction skipped - no message to react to",
      );
    }

    await ctx.conversation.send(
      "✅ UX Demo complete! All message types demonstrated.",
    );
    console.log("Completed UX demo sequence");
  }
}
