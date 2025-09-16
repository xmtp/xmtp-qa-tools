import {
  getActiveVersion,
  IdentifierKind,
  type GroupMember,
} from "version-management/client-versions";

export class GroupHandlers {
  async handleGroupMembers(ctx: any): Promise<void> {
    try {
      const members: GroupMember[] = await ctx.conversation.members();

      if (!members || members.length === 0) {
        await ctx.conversation.send("No members found in this group.");
        console.log("No members found in the group");
        return;
      }

      let membersList = "📋 **Group Members by Address:**\n\n";

      for (const member of members) {
        try {
          // Get the address from the member's inbox state
          const inboxState =
            await ctx.client.preferences.inboxStateFromInboxIds(
              [member.inboxId],
              true,
            );

          const address =
            inboxState?.[0]?.identifiers?.[0]?.identifier || "Unknown";

          // Check if this is the bot
          const isBot =
            member.inboxId.toLowerCase() === ctx.client.inboxId.toLowerCase();
          const isSender =
            member.inboxId.toLowerCase() ===
            ctx.message.senderInboxId.toLowerCase();

          let marker = "";
          if (isBot) marker += "🤖 ";
          if (isSender) marker += "👤 ";

          membersList += `${marker}**${address}**\n`;
          membersList += `  └─ Inbox: \`${member.inboxId.substring(0, 8)}...${member.inboxId.substring(member.inboxId.length - 8)}\`\n\n`;
        } catch (error) {
          console.error(
            `Error getting address for member ${member.inboxId}:`,
            error,
          );
          membersList += `❓ **Unknown Address**\n`;
          membersList += `  └─ Inbox: \`${member.inboxId.substring(0, 8)}...${member.inboxId.substring(member.inboxId.length - 8)}\`\n\n`;
        }
      }

      membersList += `\n📊 **Total Members:** ${members.length}\n`;
      membersList += "🤖 = Bot  👤 = You";

      await ctx.conversation.send(membersList);
      console.log(`Sent group members list (${members.length} members)`);
    } catch (error) {
      console.error("Error getting group members:", error);
      await ctx.conversation.send("❌ Failed to retrieve group members");
    }
  }

  async handleGroupInfo(ctx: any): Promise<void> {
    try {
      // Get basic group information
      const groupName = await ctx.conversation.groupName();
      const groupDescription = await ctx.conversation.groupDescription();
      const groupId = ctx.message.conversationId;

      let infoText = "ℹ️ **Group Information:**\n\n";

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

      await ctx.conversation.send(infoText);
      console.log("Sent group information");
    } catch (error) {
      console.error("Error getting group info:", error);
      await ctx.conversation.send("❌ Failed to retrieve group information");
    }
  }

  async handleGroupAdmins(ctx: any): Promise<void> {
    try {
      const members: GroupMember[] = await ctx.conversation.members();

      if (!members || members.length === 0) {
        await ctx.conversation.send("No members found in this group.");
        return;
      }

      // Count admins and super admins
      let adminCount = 0;
      let superAdminCount = 0;
      let adminsList = "👑 **Group Administrators:**\n\n";

      for (const member of members) {
        if (
          member.permissionLevel === "admin" ||
          member.permissionLevel === "super_admin"
        ) {
          try {
            // Get the address from the member's inbox state
            const inboxState =
              await ctx.client.preferences.inboxStateFromInboxIds(
                [member.inboxId],
                true,
              );

            const address =
              inboxState?.[0]?.identifiers?.[0]?.identifier || "Unknown";

            const isBot =
              member.inboxId.toLowerCase() === ctx.client.inboxId.toLowerCase();
            const isSender =
              member.inboxId.toLowerCase() ===
              ctx.message.senderInboxId.toLowerCase();

            let marker = "";
            if (isBot) marker += "🤖 ";
            if (isSender) marker += "👤 ";

            if (member.permissionLevel === "super_admin") {
              adminsList += `${marker}👑 **${address}** *(Super Admin)*\n`;
              superAdminCount++;
            } else {
              adminsList += `${marker}🔧 **${address}** *(Admin)*\n`;
              adminCount++;
            }

            adminsList += `  └─ Inbox: \`${member.inboxId.substring(0, 8)}...${member.inboxId.substring(member.inboxId.length - 8)}\`\n\n`;
          } catch (error) {
            console.error(
              `Error getting address for admin ${member.inboxId}:`,
              error,
            );
            if (member.permissionLevel === "super_admin") {
              adminsList += `❓ **Unknown Address** *(Super Admin)*\n`;
              superAdminCount++;
            } else {
              adminsList += `❓ **Unknown Address** *(Admin)*\n`;
              adminCount++;
            }
            adminsList += `  └─ Inbox: \`${member.inboxId.substring(0, 8)}...${member.inboxId.substring(member.inboxId.length - 8)}\`\n\n`;
          }
        }
      }

      if (adminCount === 0 && superAdminCount === 0) {
        adminsList += "*No administrators found in this group.*\n\n";
      }

      adminsList += `📊 **Summary:**\n`;
      adminsList += `👑 Super Admins: ${superAdminCount}\n`;
      adminsList += `🔧 Admins: ${adminCount}\n`;
      adminsList += `📈 Total Administrators: ${adminCount + superAdminCount}`;

      await ctx.conversation.send(adminsList);
      console.log(
        `Sent group admins list (${superAdminCount} super admins, ${adminCount} admins)`,
      );
    } catch (error) {
      console.error("Error getting group admins:", error);
      await ctx.conversation.send("❌ Failed to retrieve group administrators");
    }
  }

  async handleGroupPermissions(ctx: any): Promise<void> {
    try {
      // Get group permissions
      const groupPermissions = await ctx.conversation.groupPermissions();

      let permissionsText = "🔐 **Group Permissions:**\n\n";

      if (groupPermissions) {
        // Display permission policies
        if (groupPermissions.policyType) {
          permissionsText += `📋 **Policy Type:** ${groupPermissions.policyType}\n\n`;
        }

        // Add message permissions
        if (groupPermissions.policySet?.addMemberPolicy) {
          permissionsText += `➕ **Add Members:** ${this.formatPermissionPolicy(groupPermissions.policySet.addMemberPolicy)}\n`;
        }

        if (groupPermissions.policySet?.removeMemberPolicy) {
          permissionsText += `➖ **Remove Members:** ${this.formatPermissionPolicy(groupPermissions.policySet.removeMemberPolicy)}\n`;
        }

        if (groupPermissions.policySet?.updateGroupNamePolicy) {
          permissionsText += `✏️ **Update Group Name:** ${this.formatPermissionPolicy(groupPermissions.policySet.updateGroupNamePolicy)}\n`;
        }

        if (groupPermissions.policySet?.updateGroupDescriptionPolicy) {
          permissionsText += `📝 **Update Description:** ${this.formatPermissionPolicy(groupPermissions.policySet.updateGroupDescriptionPolicy)}\n`;
        }

        if (groupPermissions.policySet?.updateGroupImageUrlSquarePolicy) {
          permissionsText += `🖼️ **Update Group Image:** ${this.formatPermissionPolicy(groupPermissions.policySet.updateGroupImageUrlSquarePolicy)}\n`;
        }

        if (groupPermissions.policySet?.updateGroupPinnedFrameUrlPolicy) {
          permissionsText += `📌 **Update Pinned Frame:** ${this.formatPermissionPolicy(groupPermissions.policySet.updateGroupPinnedFrameUrlPolicy)}\n`;
        }
      } else {
        permissionsText +=
          "*No specific permissions configured or unable to retrieve permissions.*\n";
      }

      await ctx.conversation.send(permissionsText);
      console.log("Sent group permissions information");
    } catch (error) {
      console.error("Error getting group permissions:", error);
      await ctx.conversation.send("❌ Failed to retrieve group permissions");
    }
  }

  private formatPermissionPolicy(policy: any): string {
    if (!policy) return "Not set";

    if (policy.type === "allow") {
      return "✅ Allow All";
    } else if (policy.type === "deny") {
      return "❌ Deny All";
    } else if (policy.type === "admin") {
      return "👑 Admins Only";
    } else if (policy.type === "super_admin") {
      return "👑 Super Admins Only";
    } else {
      return `${policy.type || "Unknown"}`;
    }
  }

  async handleGroupSummary(ctx: any): Promise<void> {
    try {
      // Get all group information in one comprehensive summary
      const members: GroupMember[] = await ctx.conversation.members();
      const groupName = await ctx.conversation.groupName();
      const groupDescription = await ctx.conversation.groupDescription();
      const groupId = ctx.message.conversationId;

      let summaryText = "📊 **Complete Group Summary:**\n\n";

      // Basic Info
      summaryText += "📋 **Basic Information:**\n";
      summaryText += `  • **Name:** ${groupName && groupName.trim() ? groupName : "*No name set*"}\n`;
      summaryText += `  • **Description:** ${groupDescription && groupDescription.trim() ? groupDescription : "*No description set*"}\n`;
      summaryText += `  • **Group ID:** \`${groupId.substring(0, 8)}...${groupId.substring(groupId.length - 8)}\`\n\n`;

      // Member counts
      let adminCount = 0;
      let superAdminCount = 0;
      let memberCount = 0;

      if (members && members.length > 0) {
        for (const member of members) {
          if (member.permissionLevel === "super_admin") {
            superAdminCount++;
          } else if (member.permissionLevel === "admin") {
            adminCount++;
          } else {
            memberCount++;
          }
        }

        summaryText += "👥 **Membership:**\n";
        summaryText += `  • **Total Members:** ${members.length}\n`;
        summaryText += `  • **Super Admins:** ${superAdminCount}\n`;
        summaryText += `  • **Admins:** ${adminCount}\n`;
        summaryText += `  • **Regular Members:** ${memberCount}\n\n`;
      } else {
        summaryText += "👥 **Membership:** No members found\n\n";
      }

      summaryText += "🔍 **Available Commands:**\n";
      summaryText += "  • **Group Info** - Basic group details\n";
      summaryText += "  • **Members List** - All member addresses\n";
      summaryText += "  • **Administrators** - Admin and super admin list\n";
      summaryText += "  • **Permissions** - Group permission policies\n";

      await ctx.conversation.send(summaryText);
      console.log("Sent complete group summary");
    } catch (error) {
      console.error("Error creating group summary:", error);
      await ctx.conversation.send("❌ Failed to create group summary");
    }
  }
}
