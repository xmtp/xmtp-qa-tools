import {
  type Client,
  type DecodedMessage,
  type Group,
  type Persona,
} from "@helpers/types";

export const // Command help info
  commandHelp = `
Available commands:
/group [number] - Create a new group with [number] random personas (default: 5)
/rename [name] - Rename the current group
/add [number] - Add [number] random personas to the current group (default: 1)
/remove [number] - Remove [number] random personas from the current group (default: 1)
/groups - List all active groups
/members - List all members in the current group
/broadcast [message] - Send a message to all participants in the current group
/leave - Leave the current group
/info - Get info about the current group
/personas - List all available personas
gm - Get a greeting back
/help - Show this message
`;
export const // Random messages for group interactions
  randomMessages = [
    "Hello everyone!",
    "Thanks for adding me to this group",
    "What's everyone working on today?",
    "Excited to be here!",
    "gm to the group",
    "Let's test some features",
    "How's everyone doing?",
    "Happy to join this conversation",
    "Looking forward to working with you all",
  ];

export class CommandHandler {
  private personas: Record<string, Persona>;
  constructor(personas: Record<string, Persona>) {
    this.personas = personas;
  }
  async workers(message: DecodedMessage, client: Client) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    await conversation?.send(
      `Personas:\n${Object.keys(this.personas).join("\n")}`,
    );
  }

  // Helper to get random personas from the available list
  getRandomPersonas(count: number) {
    // Filter out excluded personas
    const eligiblePersonas = Object.values(this.personas);
    return eligiblePersonas
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(count, eligiblePersonas.length));
  }

  welcomeMessages = [
    "Thanks for adding me to the group!",
    "Hello everyone!",
    "Happy to be here",
    "Hi team!",
    "Looking forward to testing with you all",
  ];

  // Help command
  async help(message: DecodedMessage, client: Client) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    await conversation?.send(commandHelp);
  }

  // Simple gm response
  async gm(message: DecodedMessage, client: Client) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    await conversation?.send("gm");
  }

  // Create a new group
  async create(message: DecodedMessage, client: Client, args: string[] = []) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    // Parse the number of  to add (default: 5)
    const count =
      args.length > 0 && !isNaN(parseInt(args[0])) ? parseInt(args[0]) : 5;

    console.log(`Creating group with ${count} random personas...`);
    await conversation?.send(
      `hang tight, creating group with ${count} random personas...`,
    );

    // Get random personas
    const randomPersonas = this.getRandomPersonas(count);

    const personaInboxIds = randomPersonas.map(
      (p) => p.client?.inboxId as string,
    );
    const personaNames = randomPersonas.map((p) => p.name);

    // Create the group name
    const groupName = `group-${Math.random().toString(36).substring(2, 15)}`;

    // Make sure the bot and sender are included in the group
    const memberInboxIds = [
      ...personaInboxIds,
      message.senderInboxId,
      client.inboxId, // Add the bot itself
    ];

    // Create the group
    const group = await client.conversations.newGroupByInboxIds(
      memberInboxIds,
      {
        groupName: groupName,
        groupDescription: `Test group with ${count} random personas`,
      },
    );

    console.log(
      `Group created with name ${groupName} by ${message.senderInboxId}`,
    );

    await this.info(message, client);

    await this.populateGroup(group, randomPersonas, count);
  }
  async populateGroup(group: Group, personas: Persona[], count: number) {
    // Send a message as the bot
    await group.send(
      `Bot :\n Group chat initialized with ${count} personas. Welcome everyone!`,
    );
    for (const persona of personas) {
      const randomMessage =
        randomMessages[Math.floor(Math.random() * randomMessages.length)];

      const personaGroup =
        await persona.client?.conversations.getConversationById(group.id);

      await personaGroup?.send(`${persona.name}:\n${randomMessage}`);
    }
  }
  // Rename the current group
  async rename(message: DecodedMessage, client: Client, args: string[] = []) {
    const group = await client.conversations.getConversationById(
      message.conversationId,
    );
    const newName = args.join(" ").trim();
    await (group as Group).updateName(newName);
    await group?.send(`Bot :\n This group has been renamed to "${newName}"`);
  }

  // Add personas to the current group
  async add(message: DecodedMessage, client: Client, args: string[] = []) {
    // Parse the number of personas to add (default: 1)
    const count =
      args.length > 0 && !isNaN(parseInt(args[0])) ? parseInt(args[0]) : 1;

    const groupToAddTo = await client.conversations.getConversationById(
      message.conversationId,
    );
    try {
      // Get random personas not already in the group
      const personasToAdd = this.getRandomPersonas(count);

      const personaInboxIds = personasToAdd.map(
        (p) => p.client?.inboxId as string,
      );
      const personaNames = personasToAdd.map((p) => p.name);

      // Add the personas to the group
      await (groupToAddTo as Group).addMembers(personaInboxIds);

      // Announce in the group
      await groupToAddTo?.send(
        `Bot :\n Added ${personaNames.join(", ")} to the group.`,
      );

      await groupToAddTo?.send(
        `Added ${personaNames.join(", ")} to the group.`,
      );

      // Have each new persona say something
      for (const persona of personasToAdd) {
        if (this.personas[persona.name].client) {
          const welcomeMessage =
            this.welcomeMessages[
              Math.floor(Math.random() * this.welcomeMessages.length)
            ];
          const personaGroup = await Object.values(this.personas)
            .find((p) => p.client?.inboxId === persona.client?.inboxId)
            ?.client?.conversations.getConversationById(
              groupToAddTo?.id as string,
            );

          if (personaGroup) {
            await personaGroup.send(`${persona.name} :\n ${welcomeMessage}`);
          }
        }
      }
    } catch (error) {
      console.error("Error adding members to group:", error);
      await groupToAddTo?.send(
        `Error adding members: ${(error as Error).message}`,
      );
    }
  }

  // Remove personas from the current group
  async remove(message: DecodedMessage, client: Client, args: string[] = []) {
    // Parse the number of personas to remove (default: 1)
    const count =
      args.length > 0 && !isNaN(parseInt(args[0])) ? parseInt(args[0]) : 1;
    const groupToRemoveFrom = await client.conversations.getConversationById(
      message.conversationId,
    );
    try {
      // Get current members
      const currentMembers = await (groupToRemoveFrom as Group).members();

      // Filter out the sender and the bot itself - don't remove these
      const eligibleToRemove = currentMembers.filter(
        (m) =>
          m.inboxId !== message.senderInboxId && m.inboxId !== client.inboxId,
      );

      if (eligibleToRemove.length === 0) {
        await groupToRemoveFrom?.send(
          "No eligible members to remove from the group.",
        );
        return;
      }

      // Get random members to remove
      const membersToRemove = eligibleToRemove
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.min(count, eligibleToRemove.length));

      const personaNames = membersToRemove.map((member) => {
        const persona = Object.values(this.personas).find(
          (p) => (p.client?.inboxId as string) === member.inboxId,
        );
        return persona?.name;
      });

      // Announce removal before removing
      await groupToRemoveFrom?.send(
        `Bot :\n Removing ${personaNames.join(", ")} from the group.`,
      );

      // Remove the members
      await (groupToRemoveFrom as Group).removeMembers(
        membersToRemove.map((m) => m.inboxId),
      );

      await groupToRemoveFrom?.send(
        `Removed ${personaNames.join(", ")} from the group.`,
      );
    } catch (error) {
      console.error("Error removing members from group:", error);
      await groupToRemoveFrom?.send(
        `Error removing members: ${(error as Error).message}`,
      );
    }
  }

  // List all members in the current group
  async members(message: DecodedMessage, client: Client) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    try {
      // Get current members
      const members = await (conversation as Group).members();

      const memberDetails = members.map((member) => {
        const persona = Object.values(this.personas).find(
          (p) => p.client?.inboxId === member.inboxId,
        );
        return persona?.name || "You";
      });

      await conversation?.send(
        `Group members (${members.length}):\n${memberDetails.join("\n")}`,
      );
    } catch (error) {
      console.error("Error listing members:", error);
      await conversation?.send(
        `Error listing members: ${(error as Error).message}`,
      );
    }
  }

  // List all active groups
  async groups(message: DecodedMessage, client: Client) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    try {
      const groups = await client.conversations.listGroups();

      let groupsList = "Active groups:\n";
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const memberCount = await group
          .members()
          .then((members) => members.length);
        groupsList += `${i + 1}. Name: ${group.name || "Unnamed"} - ID: ${group.id} - Members: ${memberCount}\n`;
      }

      await conversation?.send(groupsList);
    } catch (error) {
      console.error("Error listing groups:", error);
      await conversation?.send(
        `Error listing groups: ${(error as Error).message}`,
      );
    }
  }

  // Broadcast a message to all participants in the current group
  async broadcast(client: Client, args: string[] = []) {
    const allGroups = await client.conversations.listGroups();

    const broadcastMessage = args.join(" ").trim();

    for (const group of allGroups) {
      await group.send(`🔊 Broadcast: ${broadcastMessage}`);
    }
  }

  // Leave the current group
  async leave(message: DecodedMessage, client: Client) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    try {
      await (conversation as Group).removeMembersByInboxId([
        message.senderInboxId,
      ]);

      await conversation?.send(`You, has left the group.`);
    } catch (error) {
      console.error("Error leaving group:", error);
      await conversation?.send(
        `Error leaving group: ${(error as Error).message}`,
      );
    }
  }

  // Get info about the current group
  async info(message: DecodedMessage, client: Client) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    try {
      const groupInfo = conversation as Group;
      const members = await groupInfo.members();
      const infoMessage = `Group info:\n- ID: ${groupInfo.id}\n- Name: ${groupInfo.name || "Unnamed"}\n- Description: ${groupInfo.description || "No description"}\n- Created: ${new Date(groupInfo.createdAt).toLocaleString()}\n- Member count: ${members.length}`;

      await conversation?.send(infoMessage);
    } catch (error) {
      console.error("Error getting group info:", error);
      await conversation?.send(
        `Error getting group info: ${(error as Error).message}`,
      );
    }
  }
}
