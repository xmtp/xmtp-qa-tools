import { ContentTypeMarkdown } from "@xmtp/content-type-markdown";
import {
  type Group,
  type IdentifierKind,
  type MessageContext,
  type PermissionLevel,
} from "../../../versions/agent-sdk";

export class GroupHandlers {
  async handleGroupMembers(ctx: MessageContext): Promise<void> {
    try {
      const members = await ctx.conversation.members();

      if (!members || members.length === 0) {
        await ctx.sendText("No members found in this group.");
        console.log("No members found in the group");
        return;
      }

      let membersList = "## 📋 Group Members by Address\n\n";

      for (const member of members) {
        try {
          // Get the address from the member's account identifiers
          const ethIdentifier = member.accountIdentifiers.find(
            (id: any) => id.identifierKind == (0 as IdentifierKind),
          );
          const address = ethIdentifier?.identifier || "Unknown";

          // Check if this is the bot
          const isBot =
            member.inboxId.toLowerCase() === ctx.client.inboxId.toLowerCase();
          const isSender =
            member.inboxId.toLowerCase() ===
            ctx.message.senderInboxId.toLowerCase();

          let marker = "";
          if (isBot) marker += "🤖 ";
          if (isSender) marker += "👤 ";

          membersList += `${marker}**${address}**  \n`;
          membersList += `└─ Inbox: \`${member.inboxId.substring(0, 8)}...${member.inboxId.substring(member.inboxId.length - 8)}\`\n\n`;
        } catch (error) {
          console.error(
            `Error getting address for member ${member.inboxId}:`,
            error,
          );
          membersList += `❓ **Unknown Address**  \n`;
          membersList += `└─ Inbox: \`${member.inboxId.substring(0, 8)}...${member.inboxId.substring(member.inboxId.length - 8)}\`\n\n`;
        }
      }

      membersList += `---\n\n`;
      membersList += `**📊 Total Members:** ${members.length}  \n`;
      membersList += `🤖 = Bot  👤 = You`;

      await ctx.conversation.send(membersList, ContentTypeMarkdown);
      console.log(`Sent group members list (${members.length} members)`);
    } catch (error) {
      console.error("Error getting group members:", error);
      await ctx.sendText("❌ Failed to retrieve group members");
    }
  }

  async handleGroupInfo(ctx: MessageContext): Promise<void> {
    try {
      const group = ctx.conversation as Group;
      // Get basic group information using properties, not async methods
      const groupName = group.name;
      const groupDescription = group.description;
      const groupId = ctx.message.conversationId;

      let infoText = "## ℹ️ Group Information\n\n";

      // Group Name
      if (groupName && groupName.trim()) {
        infoText += `📝 **Name:** ${groupName}\n\n`;
      } else {
        infoText += `📝 **Name:** *No name set*\n\n`;
      }

      // Group Description
      if (groupDescription && groupDescription.trim()) {
        infoText += `📄 **Description:** ${groupDescription}\n\n`;
      } else {
        infoText += `📄 **Description:** *No description set*\n\n`;
      }

      // Group ID (abbreviated)
      infoText += `🆔 **Group ID:** \`${groupId.substring(0, 8)}...${groupId.substring(groupId.length - 8)}\`\n\n`;
      infoText += `📋 **Full Group ID:**\n\`\`\`\n${groupId}\n\`\`\`\n`;

      await ctx.conversation.send(infoText, ContentTypeMarkdown);
      console.log("Sent group information");
    } catch (error) {
      console.error("Error getting group info:", error);
      await ctx.sendText("❌ Failed to retrieve group information");
    }
  }

  async handleGroupAdmins(ctx: MessageContext): Promise<void> {
    try {
      const members = await ctx.conversation.members();

      if (!members || members.length === 0) {
        await ctx.sendText("No members found in this group.");
        return;
      }

      // Count admins and super admins
      let adminCount = 0;
      let superAdminCount = 0;
      let adminsList = "## 👑 Group Administrators\n\n";

      for (const member of members) {
        if (
          member.permissionLevel == (1 as PermissionLevel) ||
          member.permissionLevel == (0 as PermissionLevel) ||
          member.permissionLevel == (2 as PermissionLevel)
        ) {
          try {
            // Get the address from the member's account identifiers
            const ethIdentifier = member.accountIdentifiers.find(
              (id: any) => id.identifierKind == (0 as IdentifierKind),
            );
            const address = ethIdentifier?.identifier || "Unknown";

            const isBot =
              member.inboxId.toLowerCase() === ctx.client.inboxId.toLowerCase();
            const isSender =
              member.inboxId.toLowerCase() ===
              ctx.message.senderInboxId.toLowerCase();

            let marker = "";
            if (isBot) marker += "🤖 ";
            if (isSender) marker += "👤 ";

            if (member.permissionLevel == (2 as PermissionLevel)) {
              adminsList += `${marker}👑 **${address}** *(Super Admin)*  \n`;
              superAdminCount++;
            } else {
              adminsList += `${marker}🔧 **${address}** *(Admin)*  \n`;
              adminCount++;
            }

            adminsList += `└─ Inbox: \`${member.inboxId.substring(0, 8)}...${member.inboxId.substring(member.inboxId.length - 8)}\`\n\n`;
          } catch (error) {
            console.error(
              `Error getting address for admin ${member.inboxId}:`,
              error,
            );
            if (member.permissionLevel == (2 as PermissionLevel)) {
              adminsList += `❓ **Unknown Address** *(Super Admin)*  \n`;
              superAdminCount++;
            } else {
              adminsList += `❓ **Unknown Address** *(Admin)*  \n`;
              adminCount++;
            }
            adminsList += `└─ Inbox: \`${member.inboxId.substring(0, 8)}...${member.inboxId.substring(member.inboxId.length - 8)}\`\n\n`;
          }
        }
      }

      if (adminCount === 0 && superAdminCount === 0) {
        adminsList += "*No administrators found in this group.*\n\n";
      }

      adminsList += `---\n\n`;
      adminsList += `### 📊 Summary\n\n`;
      adminsList += `- 👑 **Super Admins:** ${superAdminCount}\n`;
      adminsList += `- 🔧 **Admins:** ${adminCount}\n`;
      adminsList += `- 📈 **Total Administrators:** ${adminCount + superAdminCount}`;

      await ctx.conversation.send(adminsList, ContentTypeMarkdown);
      console.log(
        `Sent group admins list (${superAdminCount} super admins, ${adminCount} admins)`,
      );
    } catch (error) {
      console.error("Error getting group admins:", error);
      await ctx.sendText("❌ Failed to retrieve group administrators");
    }
  }

  async handleGroupPermissions(ctx: MessageContext): Promise<void> {
    try {
      // Get group admin information using Group class methods
      const group = ctx.conversation as Group;
      const admins = group.admins || [];
      const superAdmins = group.superAdmins || [];
      const members = await ctx.conversation.members();

      let permissionsText = "## 🔐 Group Permissions\n\n";

      // Display admin information
      permissionsText += `### 👑 Super Admins (${superAdmins.length})\n\n`;
      if (superAdmins.length > 0) {
        for (const superAdminInboxId of superAdmins) {
          const member = members.find(
            (m: { inboxId: string }) => m.inboxId == superAdminInboxId,
          );
          if (member) {
            const ethIdentifier = member.accountIdentifiers.find(
              (id: any) => id.identifierKind === (0 as IdentifierKind),
            );
            const address = ethIdentifier?.identifier || "Unknown";
            permissionsText += `- ${address}\n`;
          }
        }
      } else {
        permissionsText += "*No super admins*\n";
      }

      permissionsText += `\n### 🔧 Admins (${admins.length})\n\n`;
      if (admins.length > 0) {
        for (const adminInboxId of admins) {
          const member = members.find(
            (m: { inboxId: string }) => m.inboxId == adminInboxId,
          );
          if (member) {
            const ethIdentifier = member.accountIdentifiers.find(
              (id: any) => id.identifierKind === (0 as IdentifierKind),
            );
            const address = ethIdentifier?.identifier || "Unknown";
            permissionsText += `- ${address}\n`;
          }
        }
      } else {
        permissionsText += "*No admins*\n";
      }

      permissionsText += `\n### 📊 Member Summary\n\n`;
      permissionsText += `| Role | Count |\n`;
      permissionsText += `|------|-------|\n`;
      permissionsText += `| Total Members | ${members.length} |\n`;
      permissionsText += `| Super Admins | ${superAdmins.length} |\n`;
      permissionsText += `| Admins | ${admins.length} |\n`;
      permissionsText += `| Regular Members | ${members.length - admins.length - superAdmins.length} |\n\n`;

      permissionsText +=
        "---\n\n**ℹ️ Note:** XMTP groups use a role-based permission system:\n\n";
      permissionsText +=
        "- **Super Admins** can manage all aspects of the group\n";
      permissionsText +=
        "- **Admins** can perform admin-level actions based on group settings\n";
      permissionsText += "- **Members** have basic participation rights\n";

      await ctx.conversation.send(permissionsText, ContentTypeMarkdown);
      console.log("Sent group permissions information");
    } catch (error) {
      console.error("Error getting group permissions:", error);
      await ctx.sendText("❌ Failed to retrieve group permissions");
    }
  }
}
