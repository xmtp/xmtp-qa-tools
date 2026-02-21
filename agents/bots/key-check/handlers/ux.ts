import { type MessageContext } from "@agents/versions";
import { createERC20TransferCalls } from "@xmtp/agent-sdk-2.2.0";
import {
  ContentTypeRemoteAttachment,
  type RemoteAttachment,
} from "@xmtp/content-type-remote-attachment";
import { parseUnits } from "viem";
import { baseSepolia } from "viem/chains";

const USDC_BASE_SEPOLIA =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;
const USDC_DECIMALS = 6;

export class UxHandlers {
  async handleUxMiniApp(ctx: MessageContext): Promise<void> {
    try {
      const miniAppContent = `https://squabble.lol/`;
      await ctx.conversation.sendText(miniAppContent);
    } catch (error) {
      console.error("Error sending mini app:", error);
      await ctx.conversation.sendText("❌ Failed to send mini app");
    }
  }
  async handleUxAttachment(ctx: MessageContext): Promise<void> {
    try {
      const senderAddress = await ctx.getSenderAddress();

      console.log(`Preparing attachment for ${senderAddress}...`);
      await ctx.conversation.sendText(`I'll send you an attachment now...`);

      await (
        ctx.conversation as {
          send: (c: unknown, t?: unknown) => Promise<string>;
        }
      ).send(parseSavedAttachment(), ContentTypeRemoteAttachment);

      console.log("Remote attachment sent successfully");
    } catch (error) {
      console.error("❌ Error sending real attachment:", error);
      await ctx.conversation.sendText("❌ Failed to send real attachment");
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

      await ctx.conversation.sendMarkdown(markdownContent);

      await ctx.conversation.sendText(
        "✅ Markdown message sent successfully! Check how it renders in your client.",
      );
      console.log("Sent comprehensive markdown demo");
    } catch (error) {
      console.error("Error sending markdown demo:", error);
      await ctx.conversation.sendText("❌ Failed to send markdown demo");
    }
  }

  async handleBasics(ctx: MessageContext): Promise<void> {
    try {
      // First, send a text message
      const textMessage = await ctx.conversation.sendText(
        "📝 This is a text message that will be replied to and reacted to!",
      );
      console.log("Sent text message for basics demo", textMessage);

      // Step 1: Add thinking emoji reaction
      await ctx.sendReaction("❤️");

      await ctx.sendTextReply("💬 This is a reply to the text message!");

      console.log("Sent reply to text message");
    } catch (error) {
      console.error("Error in basics demo:", error);
      await ctx.conversation.sendText("❌ Failed to complete basics demo");
    }
  }

  async handleTransaction(ctx: MessageContext): Promise<void> {
    const agentAddress = await ctx.getClientAddress();
    const senderAddress = await ctx.getSenderAddress();
    if (!agentAddress || !senderAddress) {
      await ctx.conversation.sendText("❌ Could not resolve addresses");
      return;
    }

    const amount = parseUnits("0.1", USDC_DECIMALS);
    const walletSendCalls = createERC20TransferCalls({
      chain: baseSepolia,
      tokenAddress: USDC_BASE_SEPOLIA,
      from: senderAddress as `0x${string}`,
      to: agentAddress as `0x${string}`,
      amount,
      description: "Transfer 0.1 USDC to key-check agent (UX demo)",
    });
    console.log("Replied with wallet sendcall");
    await ctx.conversation.sendWalletSendCalls(walletSendCalls);
  }

  async handleDeeplink(ctx: MessageContext): Promise<void> {
    try {
      const agentAddress = ctx.client.accountIdentifier?.identifier || "";
      const deeplink = `cbwallet://messaging/${agentAddress}`;

      console.log(`Creating deeplink for agent address: ${agentAddress}`);

      // Send deeplink message as specified in the user's function
      await ctx.conversation.sendText(
        `💬 Want to chat privately? Tap here to start a direct conversation:\n\n${deeplink}`,
      );

      console.log("Deeplink message sent successfully");
    } catch (error) {
      console.error("Error creating deeplink:", error);
      await ctx.conversation.sendText("❌ Failed to create deeplink message");
    }
  }
}

function parseSavedAttachment(): RemoteAttachment {
  const parsedData = {
    url: "https://gateway.pinata.cloud/ipfs/QmUdfykA79R5Gsho1RjjEsBn7Q5Tt7vkkfHh35eW5BssoH",
    contentDigest:
      "3c80f5f3690856fce031f6de6bd1081f6136ad9b0d453961f89fedeb2594e6b7",
    salt: {
      "0": 125,
      "1": 178,
      "2": 5,
      "3": 113,
      "4": 110,
      "5": 19,
      "6": 129,
      "7": 248,
      "8": 78,
      "9": 87,
      "10": 78,
      "11": 178,
      "12": 25,
      "13": 55,
      "14": 24,
      "15": 103,
      "16": 244,
      "17": 207,
      "18": 216,
      "19": 186,
      "20": 131,
      "21": 45,
      "22": 94,
      "23": 235,
      "24": 26,
      "25": 223,
      "26": 91,
      "27": 91,
      "28": 59,
      "29": 200,
      "30": 83,
      "31": 21,
    },
    nonce: {
      "0": 207,
      "1": 135,
      "2": 145,
      "3": 166,
      "4": 63,
      "5": 217,
      "6": 122,
      "7": 160,
      "8": 18,
      "9": 129,
      "10": 41,
      "11": 128,
    },
    secret: {
      "0": 118,
      "1": 41,
      "2": 4,
      "3": 249,
      "4": 170,
      "5": 168,
      "6": 195,
      "7": 109,
      "8": 117,
      "9": 189,
      "10": 162,
      "11": 199,
      "12": 198,
      "13": 17,
      "14": 242,
      "15": 245,
      "16": 228,
      "17": 96,
      "18": 132,
      "19": 78,
      "20": 58,
      "21": 188,
      "22": 104,
      "23": 28,
      "24": 58,
      "25": 171,
      "26": 16,
      "27": 153,
      "28": 93,
      "29": 10,
      "30": 220,
      "31": 234,
    },
    scheme: "https://",
    filename: "logo.png",
    contentLength: 21829,
  } as SavedAttachmentData;

  // Convert the saved object back to proper Uint8Array format
  return {
    url: parsedData.url,
    contentDigest: parsedData.contentDigest,
    salt: new Uint8Array(Object.values(parsedData.salt)),
    nonce: new Uint8Array(Object.values(parsedData.nonce)),
    secret: new Uint8Array(Object.values(parsedData.secret)),
    scheme: parsedData.scheme,
    filename: parsedData.filename,
    contentLength: parsedData.contentLength,
  } as RemoteAttachment;
}
interface SavedAttachmentData {
  url: string;
  contentDigest: string;
  salt: Record<string, number>;
  nonce: Record<string, number>;
  secret: Record<string, number>;
  scheme: string;
  filename: string;
  contentLength: number;
}
