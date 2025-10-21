import { ContentTypeMarkdown } from "@xmtp/content-type-markdown";
import { type MessageContext } from "../../../versions/agent-sdk";

export class LoadTestHandlers {
  constructor(private agent: unknown) {}

  async handleLoadTest10Groups10Messages(ctx: MessageContext): Promise<void> {
    await ctx.sendText("🚀 Starting Load Test: 10 groups × 10 messages");
    console.log("Starting load test: 10 groups × 10 messages");

    try {
      const startTime = Date.now();
      let totalMessagesSent = 0;
      let groupsCreated = 0;
      const createdGroups: unknown[] = [];

      for (let groupIndex = 0; groupIndex < 10; groupIndex++) {
        // Create a new XMTP group with the sender included
        const groupName = `Load Test Group ${groupIndex + 1}/10 - ${new Date().toISOString()}`;
        console.log(`Creating group: ${groupName}`);

        try {
          // Create group with sender as the only member initially
          const group = await (
            this.agent as {
              client: {
                conversations: {
                  newGroup: (
                    members: string[],
                    options?: { groupName?: string; groupDescription?: string },
                  ) => Promise<{
                    name: string;
                    id: string;
                    send: (message: string) => Promise<void>;
                  }>;
                };
              };
            }
          ).client.conversations.newGroup([ctx.message.senderInboxId], {
            groupName,
            groupDescription: `Load test group ${groupIndex + 1}/10 created for testing purposes`,
          });

          createdGroups.push(group);
          groupsCreated++;
          console.log(`✅ Created group ${groupIndex + 1}/10: ${group.id}`);

          // Send messages to this group
          for (let messageIndex = 0; messageIndex < 10; messageIndex++) {
            const message = `Load test message ${messageIndex + 1}/10 in ${groupName}`;
            await group.send(message);
            totalMessagesSent++;

            // Small delay to avoid overwhelming
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          await ctx.sendText(`Completed ${groupName} (10 messages sent)`);
        } catch (groupError) {
          console.error(
            `Failed to create group ${groupIndex + 1}:`,
            groupError,
          );
          await ctx.sendText(
            `❌ Failed to create group ${groupIndex + 1}: ${String(groupError)}`,
          );
        }
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const summary = `## 🎯 Load Test Complete!

### 📊 Results

| Metric | Value |
|--------|-------|
| Groups created | ${groupsCreated} |
| Total messages sent | ${totalMessagesSent} |
| Duration | ${duration.toFixed(2)}s |
| Messages per second | ${(totalMessagesSent / duration).toFixed(2)} |

### 📋 Created Groups

${createdGroups
  .map(
    (group, index) =>
      `${index + 1}. **${(group as { name: string; id: string }).name}**  \n   ID: \`${(group as { name: string; id: string }).id.substring(0, 8)}...\``,
  )
  .join("\n\n")}`;

      await ctx.conversation.send(summary, ContentTypeMarkdown);
      console.log("Load test completed:", summary);
    } catch (error) {
      console.error("Load test failed:", error);
      await ctx.sendText(`❌ Load test failed: ${String(error)}`);
    }
  }

  async handleLoadTest50Groups10Messages(ctx: MessageContext): Promise<void> {
    await ctx.sendText("🚀 Starting Load Test: 50 groups × 10 messages");
    console.log("Starting load test: 50 groups × 10 messages");

    try {
      const startTime = Date.now();
      let totalMessagesSent = 0;
      let groupsCreated = 0;
      const createdGroups: unknown[] = [];

      for (let groupIndex = 0; groupIndex < 50; groupIndex++) {
        // Create a new XMTP group with the sender included
        const groupName = `Load Test Group ${groupIndex + 1}/50 - ${new Date().toISOString()}`;
        console.log(`Creating group: ${groupName}`);

        try {
          // Create group with sender as the only member initially
          const group = await (
            this.agent as {
              client: {
                conversations: {
                  newGroup: (
                    members: string[],
                    options?: { groupName?: string; groupDescription?: string },
                  ) => Promise<{
                    name: string;
                    id: string;
                    send: (message: string) => Promise<void>;
                  }>;
                };
              };
            }
          ).client.conversations.newGroup([ctx.message.senderInboxId], {
            groupName,
            groupDescription: `Load test group ${groupIndex + 1}/50 created for testing purposes`,
          });

          createdGroups.push(group);
          groupsCreated++;
          console.log(`✅ Created group ${groupIndex + 1}/50: ${group.id}`);

          // Send messages to this group
          for (let messageIndex = 0; messageIndex < 10; messageIndex++) {
            const message = `Load test message ${messageIndex + 1}/10 in ${groupName}`;
            await group.send(message);
            totalMessagesSent++;

            // Small delay to avoid overwhelming
            await new Promise((resolve) => setTimeout(resolve, 50));
          }

          // Progress update every 10 groups
          if ((groupIndex + 1) % 10 === 0) {
            await ctx.sendText(
              `📊 Progress: ${groupIndex + 1}/50 groups completed`,
            );
          }
        } catch (groupError) {
          console.error(
            `Failed to create group ${groupIndex + 1}:`,
            groupError,
          );
          await ctx.sendText(
            `❌ Failed to create group ${groupIndex + 1}: ${String(groupError)}`,
          );
        }
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const summary = `## 🎯 Load Test Complete!

### 📊 Results

| Metric | Value |
|--------|-------|
| Groups created | ${groupsCreated} |
| Total messages sent | ${totalMessagesSent} |
| Duration | ${duration.toFixed(2)}s |
| Messages per second | ${(totalMessagesSent / duration).toFixed(2)} |

### 📋 Created Groups (showing first 10)

${createdGroups
  .slice(0, 10)
  .map(
    (group, index) =>
      `${index + 1}. **${(group as { name: string; id: string }).name}**  \n   ID: \`${(group as { name: string; id: string }).id.substring(0, 8)}...\``,
  )
  .join("\n\n")}`;

      await ctx.conversation.send(summary, ContentTypeMarkdown);
      console.log("Load test completed:", summary);
    } catch (error) {
      console.error("Load test failed:", error);
      await ctx.sendText(`❌ Load test failed: ${String(error)}`);
    }
  }

  async handleLoadTest1Group100Messages(ctx: MessageContext): Promise<void> {
    await ctx.sendText("🚀 Starting Load Test: 1 group × 100 messages");
    console.log("Starting load test: 1 group × 100 messages");

    try {
      const startTime = Date.now();
      let totalMessagesSent = 0;
      let groupsCreated = 0;
      const createdGroups: unknown[] = [];

      // Create a single XMTP group with the sender included
      const groupName = `Load Test Group 1/1 - ${new Date().toISOString()}`;
      console.log(`Creating group: ${groupName}`);

      try {
        // Create group with sender as the only member initially
        const group = await (
          this.agent as {
            client: {
              conversations: {
                newGroup: (
                  members: string[],
                  options?: { groupName?: string; groupDescription?: string },
                ) => Promise<{
                  name: string;
                  id: string;
                  send: (message: string) => Promise<void>;
                }>;
              };
            };
          }
        ).client.conversations.newGroup([ctx.message.senderInboxId], {
          groupName,
          groupDescription: `Single load test group created for high-volume message testing`,
        });

        createdGroups.push(group);
        groupsCreated++;
        console.log(`✅ Created group: ${group.id}`);

        // Send 100 messages to this group
        for (let messageIndex = 0; messageIndex < 100; messageIndex++) {
          const message = `Load test message ${messageIndex + 1}/100 in ${groupName}`;
          await group.send(message);
          totalMessagesSent++;

          // Progress updates every 25 messages
          if ((messageIndex + 1) % 25 === 0) {
            await ctx.sendText(
              `📊 Progress: ${messageIndex + 1}/100 messages sent`,
            );
          }

          // Small delay to avoid overwhelming
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } catch (groupError) {
        console.error(`Failed to create group:`, groupError);
        await ctx.sendText(`❌ Failed to create group: ${String(groupError)}`);
        return;
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const summary = `## 🎯 Load Test Complete!

### 📊 Results

| Metric | Value |
|--------|-------|
| Groups created | ${groupsCreated} |
| Total messages sent | ${totalMessagesSent} |
| Duration | ${duration.toFixed(2)}s |
| Messages per second | ${(totalMessagesSent / duration).toFixed(2)} |

### 📋 Created Group

${createdGroups
  .map(
    (group, index) =>
      `${index + 1}. **${(group as { name: string; id: string }).name}**  \n   ID: \`${(group as { name: string; id: string }).id.substring(0, 8)}...\``,
  )
  .join("\n\n")}`;

      await ctx.conversation.send(summary, ContentTypeMarkdown);
      console.log("Load test completed:", summary);
    } catch (error) {
      console.error("Load test failed:", error);
      await ctx.sendText(`❌ Load test failed: ${String(error)}`);
    }
  }

  async handleLoadTestCustom(
    ctx: MessageContext,
    groups: number,
    messagesPerGroup: number,
  ): Promise<void> {
    await ctx.sendText(
      `🚀 Starting Custom Load Test: ${groups} groups × ${messagesPerGroup} messages`,
    );
    console.log(
      `Starting custom load test: ${groups} groups × ${messagesPerGroup} messages`,
    );

    try {
      const startTime = Date.now();
      let totalMessagesSent = 0;
      let groupsCreated = 0;
      const createdGroups: unknown[] = [];

      for (let groupIndex = 0; groupIndex < groups; groupIndex++) {
        // Create a new XMTP group with the sender included
        const groupName = `Custom Load Test Group ${groupIndex + 1}/${groups} - ${new Date().toISOString()}`;
        console.log(`Creating group: ${groupName}`);

        try {
          // Create group with sender as the only member initially
          const group = await (
            this.agent as {
              client: {
                conversations: {
                  newGroup: (
                    members: string[],
                    options?: { groupName?: string; groupDescription?: string },
                  ) => Promise<{
                    name: string;
                    id: string;
                    send: (message: string) => Promise<void>;
                  }>;
                };
              };
            }
          ).client.conversations.newGroup(
            [], // Start with empty member list, sender is automatically included
            {
              groupName,
              groupDescription: `Custom load test group ${groupIndex + 1}/${groups} (${messagesPerGroup} messages)`,
            },
          );

          createdGroups.push(group);
          groupsCreated++;
          console.log(
            `✅ Created group ${groupIndex + 1}/${groups}: ${group.id}`,
          );

          // Send messages to this group
          for (
            let messageIndex = 0;
            messageIndex < messagesPerGroup;
            messageIndex++
          ) {
            const message = `Load test message ${messageIndex + 1}/${messagesPerGroup} in ${groupName}`;
            await group.send(message);
            totalMessagesSent++;

            // Small delay to avoid overwhelming
            await new Promise((resolve) => setTimeout(resolve, 50));
          }

          // Progress update for larger tests
          if (groups > 10 && (groupIndex + 1) % Math.ceil(groups / 10) === 0) {
            await ctx.sendText(
              `📊 Progress: ${groupIndex + 1}/${groups} groups completed`,
            );
          }
        } catch (groupError) {
          console.error(
            `Failed to create group ${groupIndex + 1}:`,
            groupError,
          );
          await ctx.sendText(
            `❌ Failed to create group ${groupIndex + 1}: ${String(groupError)}`,
          );
        }
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const summary = `## 🎯 Custom Load Test Complete!

### 📊 Results

| Metric | Value |
|--------|-------|
| Groups created | ${groupsCreated} |
| Total messages sent | ${totalMessagesSent} |
| Duration | ${duration.toFixed(2)}s |
| Messages per second | ${(totalMessagesSent / duration).toFixed(2)} |

### 📋 Created Groups${createdGroups.length > 10 ? " (showing first 10)" : ""}

${createdGroups
  .slice(0, 10)
  .map(
    (group, index) =>
      `${index + 1}. **${(group as { name: string; id: string }).name}**  \n   ID: \`${(group as { name: string; id: string }).id.substring(0, 8)}...\``,
  )
  .join("\n\n")}`;

      await ctx.conversation.send(summary, ContentTypeMarkdown);
      console.log("Custom load test completed:", summary);
    } catch (error) {
      console.error("Custom load test failed:", error);
      await ctx.sendText(`❌ Custom load test failed: ${String(error)}`);
    }
  }
}
