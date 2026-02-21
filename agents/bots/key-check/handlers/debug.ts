import { createRequire } from "node:module";
import { type MessageContext } from "@agents/versions";

// Get XMTP SDK version from package.json
const require = createRequire(import.meta.url);
const packageJson = require("../../../../package.json");
const xmtpSdkVersion: string =
  packageJson.dependencies["@xmtp/agent-sdk"] ?? "unknown";

export class DebugHandlers {
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
  }

  async handleHelp(ctx: MessageContext, helpText: string): Promise<void> {
    await ctx.conversation.sendText(helpText);
    console.log("Sent help information");
  }

  async handleVersion(ctx: MessageContext): Promise<void> {
    await ctx.conversation.sendText(
      `XMTP agent-sdk Version: ${xmtpSdkVersion}`,
    );
    console.log(`Sent XMTP agent-sdk version: ${xmtpSdkVersion}`);
  }

  async handleUptime(ctx: MessageContext): Promise<void> {
    const currentTime = new Date();
    const uptimeMs = currentTime.getTime() - this.startTime.getTime();

    // Convert milliseconds to days, hours, minutes, seconds
    const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);

    const uptimeText =
      `Bot started at: ${this.startTime.toLocaleString()}\n` +
      `Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s`;

    await ctx.conversation.sendText(uptimeText);
    console.log(`Sent uptime information: ${uptimeText}`);
  }

  async handleDebug(ctx: MessageContext): Promise<void> {
    let conversations = await ctx.client.conversations.list();
    // Print the list of conversations ids to console:
    console.log(
      "Conversations:",
      conversations.map((conversation: any) => conversation.id),
    );
    await ctx.conversation.sendText(
      `key-check conversations: \n${conversations.map((conversation: any) => conversation.id).join("\n")}`,
    );
  }

  async handleDebugInfo(ctx: MessageContext): Promise<void> {
    // Get all the information from the three separate handlers
    const currentTime = new Date();
    const uptimeMs = currentTime.getTime() - this.startTime.getTime();

    // Convert milliseconds to days, hours, minutes, seconds
    const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);

    // Get conversations
    const conversations = await ctx.client.conversations.list();

    // Get client details
    const address = ctx.getClientAddress() as string;
    const inboxId = ctx.client.inboxId;
    const installationId = ctx.client.installationId;
    const appVersion = ctx.client.options?.appVersion;
    const env = ctx.client.options?.env ?? "dev";

    // Get inbox state and key package info
    const inboxState = await ctx.client.preferences.inboxState();
    const keyPackageStatuses = await ctx.client.fetchKeyPackageStatuses([
      installationId,
    ]);
    const keyPackageStatus = keyPackageStatuses[installationId];

    let createdDate = new Date();
    let expiryDate = new Date();
    if (keyPackageStatus?.lifetime) {
      createdDate = new Date(
        Number(keyPackageStatus.lifetime.notBefore) * 1000,
      );
      expiryDate = new Date(Number(keyPackageStatus.lifetime.notAfter) * 1000);
    }

    // Create comprehensive debug info
    const debugInfo = `## 🔧 Key-Check Bot Debug Information

### 📦 Version Info
- **XMTP Agent SDK:** ${xmtpSdkVersion}
- **Client Version:** ${ctx.client.constructor.name}
- **App Version:** ${appVersion}
- **Environment:** ${env}

### ⏰ Uptime Info
- **Started:** ${this.startTime.toLocaleString()}
- **Uptime:** ${days}d ${hours}h ${minutes}m ${seconds}s

### 🔑 Client Details
- **Address:** \`${address}\`
- **Inbox ID:** \`${inboxId}\`
- **Installation ID:** \`${installationId}\`
- **Total Installations:** ${inboxState.installations.length}
- **Key Package Created:** ${createdDate.toLocaleString()}
- **Key Package Valid Until:** ${expiryDate.toLocaleString()}

### 💬 Conversations
- **Total:** ${conversations.length}

### 🛠️ System Status
- **Bot Status:** ✅ Running
- **Last Updated:** ${currentTime.toLocaleString()}`;

    await ctx.conversation.sendMarkdown(debugInfo);
    console.log("Sent comprehensive debug information");
  }
}
