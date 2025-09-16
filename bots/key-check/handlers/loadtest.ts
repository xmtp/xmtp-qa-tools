export class LoadTestHandlers {
  constructor(private agent: any) {}

  async handleLoadTest10Groups10Messages(ctx: any): Promise<void> {
    await ctx.conversation.send(
      "🚀 Starting Load Test: 10 groups × 10 messages",
    );
    console.log("Starting load test: 10 groups × 10 messages");

    try {
      const startTime = Date.now();
      let totalMessagesSent = 0;
      let groupsCreated = 0;
      const createdGroups: any[] = [];

      for (let groupIndex = 0; groupIndex < 10; groupIndex++) {
        // Create a new XMTP group with the sender included
        const groupName = `Load Test Group ${groupIndex + 1}/10 - ${new Date().toISOString()}`;
        console.log(`Creating group: ${groupName}`);

        try {
          // Create group with sender as the only member initially
          const group = await this.agent.client.conversations.newGroup(
            [], // Start with empty member list, sender is automatically included
            {
              groupName,
              groupDescription: `Load test group ${groupIndex + 1}/10 created for testing purposes`,
            },
          );

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

          await ctx.conversation.send(
            `✅ Completed ${groupName} (10 messages sent)`,
          );
        } catch (groupError) {
          console.error(
            `Failed to create group ${groupIndex + 1}:`,
            groupError,
          );
          await ctx.conversation.send(
            `❌ Failed to create group ${groupIndex + 1}: ${groupError}`,
          );
        }
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const summary =
        `🎯 Load Test Complete!\n` +
        `📊 Groups created: ${groupsCreated}\n` +
        `📨 Total messages sent: ${totalMessagesSent}\n` +
        `⏱️ Duration: ${duration.toFixed(2)} seconds\n` +
        `📈 Messages per second: ${(totalMessagesSent / duration).toFixed(2)}\n\n` +
        `📋 Created Groups:\n` +
        createdGroups
          .map(
            (group, index) =>
              `${index + 1}. ${group.name} (ID: ${group.id.substring(0, 8)}...)`,
          )
          .join("\n");

      await ctx.conversation.send(summary);
      console.log("Load test completed:", summary);
    } catch (error) {
      console.error("Load test failed:", error);
      await ctx.conversation.send(`❌ Load test failed: ${error}`);
    }
  }

  async handleLoadTest50Groups10Messages(ctx: any): Promise<void> {
    await ctx.conversation.send(
      "🚀 Starting Load Test: 50 groups × 10 messages",
    );
    console.log("Starting load test: 50 groups × 10 messages");

    try {
      const startTime = Date.now();
      let totalMessagesSent = 0;
      let groupsCreated = 0;
      const createdGroups: any[] = [];

      for (let groupIndex = 0; groupIndex < 50; groupIndex++) {
        // Create a new XMTP group with the sender included
        const groupName = `Load Test Group ${groupIndex + 1}/50 - ${new Date().toISOString()}`;
        console.log(`Creating group: ${groupName}`);

        try {
          // Create group with sender as the only member initially
          const group = await this.agent.client.conversations.newGroup(
            [], // Start with empty member list, sender is automatically included
            {
              groupName,
              groupDescription: `Load test group ${groupIndex + 1}/50 created for testing purposes`,
            },
          );

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
            await ctx.conversation.send(
              `📊 Progress: ${groupIndex + 1}/50 groups completed`,
            );
          }
        } catch (groupError) {
          console.error(
            `Failed to create group ${groupIndex + 1}:`,
            groupError,
          );
          await ctx.conversation.send(
            `❌ Failed to create group ${groupIndex + 1}: ${groupError}`,
          );
        }
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const summary =
        `🎯 Load Test Complete!\n` +
        `📊 Groups created: ${groupsCreated}\n` +
        `📨 Total messages sent: ${totalMessagesSent}\n` +
        `⏱️ Duration: ${duration.toFixed(2)} seconds\n` +
        `📈 Messages per second: ${(totalMessagesSent / duration).toFixed(2)}\n\n` +
        `📋 Created Groups (showing first 10):\n` +
        createdGroups
          .slice(0, 10)
          .map(
            (group, index) =>
              `${index + 1}. ${group.name} (ID: ${group.id.substring(0, 8)}...)`,
          )
          .join("\n");

      await ctx.conversation.send(summary);
      console.log("Load test completed:", summary);
    } catch (error) {
      console.error("Load test failed:", error);
      await ctx.conversation.send(`❌ Load test failed: ${error}`);
    }
  }

  async handleLoadTest1Group100Messages(ctx: any): Promise<void> {
    await ctx.conversation.send(
      "🚀 Starting Load Test: 1 group × 100 messages",
    );
    console.log("Starting load test: 1 group × 100 messages");

    try {
      const startTime = Date.now();
      let totalMessagesSent = 0;
      let groupsCreated = 0;
      const createdGroups: any[] = [];

      // Create a single XMTP group with the sender included
      const groupName = `Load Test Group 1/1 - ${new Date().toISOString()}`;
      console.log(`Creating group: ${groupName}`);

      try {
        // Create group with sender as the only member initially
        const group = await this.agent.client.conversations.newGroup(
          [], // Start with empty member list, sender is automatically included
          {
            groupName,
            groupDescription: `Single load test group created for high-volume message testing`,
          },
        );

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
            await ctx.conversation.send(
              `📊 Progress: ${messageIndex + 1}/100 messages sent`,
            );
          }

          // Small delay to avoid overwhelming
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } catch (groupError) {
        console.error(`Failed to create group:`, groupError);
        await ctx.conversation.send(`❌ Failed to create group: ${groupError}`);
        return;
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const summary =
        `🎯 Load Test Complete!\n` +
        `📊 Groups created: ${groupsCreated}\n` +
        `📨 Total messages sent: ${totalMessagesSent}\n` +
        `⏱️ Duration: ${duration.toFixed(2)} seconds\n` +
        `📈 Messages per second: ${(totalMessagesSent / duration).toFixed(2)}\n\n` +
        `📋 Created Group:\n` +
        createdGroups
          .map(
            (group, index) =>
              `${index + 1}. ${group.name} (ID: ${group.id.substring(0, 8)}...)`,
          )
          .join("\n");

      await ctx.conversation.send(summary);
      console.log("Load test completed:", summary);
    } catch (error) {
      console.error("Load test failed:", error);
      await ctx.conversation.send(`❌ Load test failed: ${error}`);
    }
  }

  async handleLoadTestCustom(
    ctx: any,
    groups: number,
    messagesPerGroup: number,
  ): Promise<void> {
    await ctx.conversation.send(
      `🚀 Starting Custom Load Test: ${groups} groups × ${messagesPerGroup} messages`,
    );
    console.log(
      `Starting custom load test: ${groups} groups × ${messagesPerGroup} messages`,
    );

    try {
      const startTime = Date.now();
      let totalMessagesSent = 0;
      let groupsCreated = 0;
      const createdGroups: any[] = [];

      for (let groupIndex = 0; groupIndex < groups; groupIndex++) {
        // Create a new XMTP group with the sender included
        const groupName = `Custom Load Test Group ${groupIndex + 1}/${groups} - ${new Date().toISOString()}`;
        console.log(`Creating group: ${groupName}`);

        try {
          // Create group with sender as the only member initially
          const group = await this.agent.client.conversations.newGroup(
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
            await ctx.conversation.send(
              `📊 Progress: ${groupIndex + 1}/${groups} groups completed`,
            );
          }
        } catch (groupError) {
          console.error(
            `Failed to create group ${groupIndex + 1}:`,
            groupError,
          );
          await ctx.conversation.send(
            `❌ Failed to create group ${groupIndex + 1}: ${groupError}`,
          );
        }
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const summary =
        `🎯 Custom Load Test Complete!\n` +
        `📊 Groups created: ${groupsCreated}\n` +
        `📨 Total messages sent: ${totalMessagesSent}\n` +
        `⏱️ Duration: ${duration.toFixed(2)} seconds\n` +
        `📈 Messages per second: ${(totalMessagesSent / duration).toFixed(2)}\n\n` +
        `📋 Created Groups${createdGroups.length > 10 ? " (showing first 10)" : ""}:\n` +
        createdGroups
          .slice(0, 10)
          .map(
            (group, index) =>
              `${index + 1}. ${group.name} (ID: ${group.id.substring(0, 8)}...)`,
          )
          .join("\n");

      await ctx.conversation.send(summary);
      console.log("Custom load test completed:", summary);
    } catch (error) {
      console.error("Custom load test failed:", error);
      await ctx.conversation.send(`❌ Custom load test failed: ${error}`);
    }
  }

  async handleLoadTestHelp(ctx: any): Promise<void> {
    const helpText =
      `🧪 Load Testing Help\n\n` +
      `Available load test scenarios:\n\n` +
      `🔹 10 Groups × 10 Messages (100 total)\n` +
      `   - Quick test for basic load handling\n\n` +
      `🔹 50 Groups × 10 Messages (500 total)\n` +
      `   - Medium load test for group creation\n\n` +
      `🔹 1 Group × 100 Messages (100 total)\n` +
      `   - High message volume in single group\n\n` +
      `🔹 Custom (Groups × Messages)\n` +
      `   - Specify your own parameters\n` +
      `   - Format: "10 5" for 10 groups × 5 messages\n\n` +
      `✅ Note: These load tests create real XMTP groups.\n` +
      `Each group includes the sender and has a descriptive name.`;

    await ctx.conversation.send(helpText);
    console.log("Sent load testing help information");
  }
}
