import {
  Group,
  type Client,
  type DecodedMessage,
  type NestedPersonas,
  type Persona,
} from "@helpers/types";

export const // Command help info
  commandHelp = `Available commands:
gm - Get a greeting back from the bot
hi [name] - Get a response back to [name]
/create [number] - Create a new group with [number] random personas (default: 5)
/rename [name] - Rename the current group
/add [name] - Add [name] to the current group
/remove [name] - Remove [name] from the current group
/block [name] - Block [name] from the current group
/unblock [name] - Unblock [name] from the current group 
/groups - List all active groups
/members - List all members in the current group
/admins - List all admins in the current group
/blast [message] [count] [repeat] - Send a message to all participants in the current group
/leave - Leave the current group
/info - Get info about the current group
/workers - List all available personas
/help - Show this message`;

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
  private personas: NestedPersonas;
  constructor(personas: NestedPersonas) {
    this.personas = personas;
  }
  async workers(message: DecodedMessage, client: Client) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    await conversation?.send(
      `Personas:\n${this.personas
        .getPersonas()
        .map((p) => p.name)
        .join("\n")}`,
    );
  }

  // Helper to get random personas from the available list
  getRandomPersonas(count: number) {
    // Filter out excluded personas
    const eligiblePersonas = this.personas.getPersonas();
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
  async block(message: DecodedMessage, client: Client, args: string[] = []) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    await conversation?.send(`blocked ${args.join(" ")}`);
  }
  async unblock(message: DecodedMessage, client: Client, args: string[] = []) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    await conversation?.send(`unblocked ${args.join(" ")}`);
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

    const personaInboxIds = randomPersonas.map((p) => p.client.inboxId);

    // Create the group name
    const groupName = `group-${Math.random().toString(36).substring(2, 15)}`;

    // Make sure the bot and sender are included in the group
    const memberInboxIds = [
      ...personaInboxIds,
      message.senderInboxId,
      client.inboxId,
    ];
    console.log(memberInboxIds);
    // Create the group
    const group = await client.conversations.newGroup(memberInboxIds, {
      groupName: groupName,
      groupDescription: `Test group with ${count} random personas`,
    });
    await group.addSuperAdmin(message.senderInboxId);

    console.log(
      `Group created with name ${groupName} by ${message.senderInboxId}`,
    );
    await conversation?.send(
      `Group created with name ${groupName} by ${message.senderInboxId}`,
    );
    // Send a message as the bot
    await group.send(
      `Bot :\n Group chat initialized with ${count} personas. Welcome everyone!`,
    );
    await this.populateGroup(group, randomPersonas);
  }
  async populateGroup(group: Group, personas: Persona[]) {
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
    const groupToAddTo = await client.conversations.getConversationById(
      message.conversationId,
    );

    try {
      if (!(groupToAddTo instanceof Group)) {
        await groupToAddTo?.send("Group not found");
        return;
      }
      // Check if a persona name was provided
      if (args.length === 0) {
        await groupToAddTo.send("Please specify a persona name to add");
        return;
      }

      const personaName = args[0].trim();

      // Check if the persona exists
      if (!this.personas.get(personaName)) {
        await groupToAddTo.send(`Persona "${personaName}" not found`);
        return;
      }

      const personaToAdd2 = this.personas.get(personaName);

      // Check if the persona is already in the group
      const currentMembers = await groupToAddTo.members();
      const isAlreadyMember = currentMembers.some(
        (member) => member.inboxId === personaToAdd2?.client?.inboxId,
      );

      if (isAlreadyMember) {
        await groupToAddTo.send(
          `${personaName} is already a member of this group`,
        );
        return;
      }

      // Add the persona to the group
      await groupToAddTo.addMembers([personaToAdd2?.client?.inboxId as string]);

      // Announce in the group
      await groupToAddTo.send(`Bot :\n Added ${personaName} to the group.`);
      if (personaToAdd2) {
        await this.populateGroup(groupToAddTo, [personaToAdd2]);
      }
    } catch (error) {
      console.error("Error adding member to group:", error);
      await groupToAddTo?.send(
        `Error adding member: ${(error as Error).message}`,
      );
    }
  }

  // Remove personas from the current group
  async remove(message: DecodedMessage, client: Client, args: string[] = []) {
    const groupToRemoveFrom = await client.conversations.getConversationById(
      message.conversationId,
    );
    try {
      if (!(groupToRemoveFrom instanceof Group)) {
        await groupToRemoveFrom?.send("Group not found");
        return;
      }
      // Check if a persona name was provided
      if (args.length === 0) {
        await groupToRemoveFrom.send(
          "Please specify a persona name to remove. Check /workers to see all available personas",
        );
        return;
      }

      const personaName = args[0].trim();

      // Check if the persona exists
      if (!this.personas.get(personaName)) {
        await groupToRemoveFrom.send(
          `Persona "${personaName}" not found. Check /workers to see all available personas`,
        );
        return;
      }

      const personaToRemove = this.personas.get(personaName);

      // Get current members
      const currentMembers = await groupToRemoveFrom.members();

      // Check if the persona is in the group
      const memberToRemove = currentMembers.find(
        (member) => member.inboxId === personaToRemove?.client?.inboxId,
      );

      if (!memberToRemove) {
        await groupToRemoveFrom.send(
          `${personaName} is not a member of this group`,
        );
        return;
      }

      // Don't allow removing the sender or the bot
      if (
        memberToRemove.inboxId === message.senderInboxId ||
        memberToRemove.inboxId === client.inboxId
      ) {
        await groupToRemoveFrom.send(
          `Cannot remove ${personaName} from the group`,
        );
        return;
      }

      // Announce removal before removing
      await groupToRemoveFrom.send(
        `Bot :\n Removing ${personaName} from the group.`,
      );

      // Remove the member
      await groupToRemoveFrom.removeMembers([memberToRemove.inboxId]);

      await groupToRemoveFrom.send(`Removed ${personaName} from the group.`);
    } catch (error) {
      console.error("Error removing member from group:", error);
      await groupToRemoveFrom?.send(
        `Error removing member: ${(error as Error).message}`,
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
        const persona = this.personas
          .getPersonas()
          .find((p) => p.client?.inboxId === member.inboxId);
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
  async admins(message: DecodedMessage, client: Client) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    if (!(conversation instanceof Group)) {
      await conversation?.send("Group not found");
      return;
    }
    try {
      // Get current members
      await conversation.sync();
      const admins = await conversation.admins;
      const superAdmins = await conversation.superAdmins;
      console.log(admins);
      console.log(superAdmins);
      const allAdmins = [...admins, ...superAdmins];
      const adminDetails = allAdmins.map((admin) => {
        const persona = this.personas
          .getPersonas()
          .find((p) => p.client?.inboxId === admin);
        return persona?.name || "You";
      });

      await conversation.send(
        `Group admins (${allAdmins.length}):\n${adminDetails.join("\n")}`,
      );
    } catch (error) {
      console.error("Error listing admins:", error);
      await conversation.send(
        `Error listing admins: ${(error as Error).message}`,
      );
    }
  }

  // List all active groups
  async groups(message: DecodedMessage, client: Client) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    try {
      const preGroups = await client.conversations.listGroups();
      const groupsImAdmin = preGroups.filter((group) =>
        group.isAdmin(message.senderInboxId),
      );
      const groupsHasBot = groupsImAdmin.filter((group) =>
        group.isAdmin(client.inboxId),
      );
      let groupsList = "Active groups:\n";
      for (let i = 0; i < groupsHasBot.length; i++) {
        const group = groupsHasBot[i];
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
  async blast(message: DecodedMessage, client: Client, args: string[] = []) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    // Extract the message and optional count parameters
    // Format: /blast <message> <count> <repeat>
    // Example: /blast jaja 5 5 - sends "jaja" to 5 personas, 5 times each

    // Get the message from all arguments
    let blastMessage = args.join(" ").trim();

    // Default values
    let countOfPersonas = 5; // Number of personas to message
    let repeatCount = 1; // Number of times to send the message

    // Check if the last two arguments are numbers
    const lastArg = args[args.length - 1];
    const secondLastArg = args[args.length - 2];

    if (
      lastArg &&
      !isNaN(parseInt(lastArg)) &&
      secondLastArg &&
      !isNaN(parseInt(secondLastArg))
    ) {
      repeatCount = parseInt(lastArg);
      countOfPersonas = parseInt(secondLastArg);
      // Remove the numbers from the message
      const messageWords = blastMessage.split(" ");
      blastMessage = messageWords.slice(0, messageWords.length - 2).join(" ");
    }

    await conversation?.send(`🔊 Blasting message: ${blastMessage}`);
    for (let i = 0; i < repeatCount; i++) {
      for (const persona of this.personas
        .getPersonas()
        .slice(0, countOfPersonas)) {
        const personaGroup = await persona.client?.conversations.newDm(
          message.senderInboxId,
        );
        await conversation?.send(` ${persona.name} just sent you a message`);
        await personaGroup?.send(`${persona.name}:\n${blastMessage}`);
      }
    }
  }

  // Broadcast a message to all participants in all groups
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
      await (conversation as Group).removeMembers([message.senderInboxId]);

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
