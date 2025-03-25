import {
  Group,
  IdentifierKind,
  type Client,
  type DecodedMessage,
  type Worker,
  type WorkerManager,
} from "@helpers/types";

export const walletUser = "0x3b9B663B435787cE05D734ab32ebD9B0DBd88A53";
export const // Command help info
  commandHelp = `Available commands:
gm - Get a greeting back from the bot
hi [name] - Get a response back to [name]
/create [number] - Create a new group with [number] random workers (default: 5)
/verify - Verify that the group was created in the web client
/rename [name] - Rename the current group
/add [name] - Add [name] to the current group
/remove [name] - Remove [name] from the current group
/block [name] - Block [name] from the current group
/unblock [name] - Unblock [name] from the current group 
/groups - List all active groups
/members - List all members in the current group
/me - Get your address, inbox id and installation id
/admins - List all admins in the current group
/blast [message] [count] [repeat] - Send a message to all participants in the current group
/leave - Leave the current group
/info - Get info about the current group
/workers - List all available workers
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
  async workers(
    message: DecodedMessage,
    client: Client,
    workers: WorkerManager,
  ) {
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    await conversation?.send(
      `Workers:\n${workers
        .getWorkers()
        .map((p) => p.name)
        .join("\n")}`,
    );
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
    try {
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );
      console.log("conversation", conversation?.id);
      await conversation?.send("gm");
    } catch (error) {
      console.error("Error sending gm:", error);
    }
  }
  async me(message: DecodedMessage, client: Client) {
    try {
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );
      const inboxState = await client.preferences.inboxStateFromInboxIds([
        message.senderInboxId,
      ]);
      const addresses = inboxState[0].identifiers
        .filter((i) => i.identifierKind === IdentifierKind.Ethereum)
        .map((i) => i.identifier);

      await conversation?.send(addresses[0]);
      await conversation?.send(inboxState[0].inboxId);
      await conversation?.send(inboxState[0].installations[0].id);
    } catch (error) {
      console.error("Error sending me:", error);
    }
  }
  async block(message: DecodedMessage, client: Client, args: string[] = []) {
    try {
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );
      await conversation?.send(`blocked ${args.join(" ")}`);
    } catch (error) {
      console.error("Error blocking:", error);
    }
  }
  async unblock(message: DecodedMessage, client: Client, args: string[] = []) {
    try {
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );
      await conversation?.send(`unblocked ${args.join(" ")}`);
    } catch (error) {
      console.error("Error unblocking:", error);
    }
  }
  // Create a new group
  async create(
    message: DecodedMessage,
    client: Client,
    args: string[] = [],
    workers: WorkerManager,
  ) {
    try {
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );

      // Parse the number of  to add (default: 5)
      const count =
        args.length > 0 && !isNaN(parseInt(args[0])) ? parseInt(args[0]) : 5;

      console.log(`Creating group with ${count} random workers...`);
      await conversation?.send(
        `hang tight, creating group with ${count} random workers...`,
      );

      // Get random workers
      const randomWorkers = workers.getRandomWorkers(count);

      const workerInboxIds = randomWorkers.map((p) => p.client.inboxId);

      // Create the group name

      // Make sure the bot and sender are included in the group
      const memberInboxIds = [
        ...workerInboxIds,
        message.senderInboxId,
        client.inboxId,
      ];
      // Create the group
      const groupName = `testBotGroup-${Math.random().toString(36).substring(2, 15)}`;
      const group = await client.conversations.newGroup(memberInboxIds, {
        groupName: groupName,
        groupDescription: "This is a test group",
      });
      await group.addSuperAdmin(message.senderInboxId);
      await group.addMembersByIdentifiers([
        {
          identifierKind: IdentifierKind.Ethereum,
          identifier: walletUser,
        },
      ]);
      await group.addSuperAdmin(walletUser);

      await conversation?.send(
        `Bot :\n populating group with messsges from  random workers...`,
      );
      await group.send(
        `Bot :\n Group chat initialized with ${count} workers, you and web wallet: ${walletUser} are super admins. Welcome everyone!`,
      );
      await this.populateGroup(group.id, randomWorkers); // Send a message as the bot

      await conversation?.send(`Group created with name ${group.name}`);
    } catch (error) {
      console.error("Error creating group:", error);
    }
  }
  async populateGroup(groupID: string, workers: Worker[]) {
    try {
      for (const worker of workers) {
        const randomMessage =
          randomMessages[Math.floor(Math.random() * randomMessages.length)];
        await worker.client?.conversations.sync();
        const workerGroup =
          await worker.client?.conversations.getConversationById(groupID);
        await workerGroup?.send(`${worker.name}:\n${randomMessage}`);
      }
    } catch (error) {
      console.error("Error populating group:", error);
    }
  }
  // Rename the current group
  async rename(message: DecodedMessage, client: Client, args: string[] = []) {
    try {
      await client.conversations.sync();
      const newName = args.join(" ").trim();

      const groupToUpdate = await client.conversations.getConversationById(
        message.conversationId,
      );
      console.log("conversation", groupToUpdate?.id);
      await groupToUpdate?.sync();
      await (groupToUpdate as Group).updateName(newName);

      await groupToUpdate?.send(
        `Bot :\n This group has been renamed to "${newName}"`,
      );
    } catch (error) {
      console.error("Error renaming group:", error);
    }
  }

  // Add workers to the current group
  async add(
    message: DecodedMessage,
    client: Client,
    args: string[] = [],
    workers: WorkerManager,
  ) {
    try {
      await client.conversations.sync();
      const groupToAddTo = await client.conversations.getConversationById(
        message.conversationId,
      );

      if (!(groupToAddTo instanceof Group)) {
        await groupToAddTo?.send("Group not found");
        return;
      }
      // Check if a worker name was provided
      if (args.length === 0) {
        await groupToAddTo.send("Please specify a worker name to add");
        return;
      }

      const workerName = args[0].trim();

      // Check if the worker exists
      if (!workers.get(workerName)) {
        await groupToAddTo.send(`Worker "${workerName}" not found`);
        return;
      }

      const workerToAdd2 = workers.get(workerName);

      // Check if the worker is already in the group
      const currentMembers = await groupToAddTo.members();
      const isAlreadyMember = currentMembers.some(
        (member) => member.inboxId === workerToAdd2?.client?.inboxId,
      );

      if (isAlreadyMember) {
        await groupToAddTo.send(
          `${workerName} is already a member of this group`,
        );
        return;
      }

      // Add the worker to the group
      await groupToAddTo.addMembers([workerToAdd2?.client?.inboxId as string]);

      // Announce in the group
      await groupToAddTo.send(`Bot :\n Added ${workerName} to the group.`);
      if (workerToAdd2) {
        await this.populateGroup(groupToAddTo.id, [workerToAdd2]);
      }
    } catch (error) {
      console.error("Error adding member to group:", error);
    }
  }

  // Remove workers from the current group
  async remove(
    message: DecodedMessage,
    client: Client,
    args: string[] = [],
    workers: WorkerManager,
  ) {
    try {
      await client.conversations.sync();
      const groupToRemoveFrom = await client.conversations.getConversationById(
        message.conversationId,
      );
      if (!(groupToRemoveFrom instanceof Group)) {
        await groupToRemoveFrom?.send("Group not found");
        return;
      }
      // Check if a worker name was provided
      if (args.length === 0) {
        await groupToRemoveFrom.send(
          "Please specify a worker name to remove. Check /workers to see all available workers",
        );
        return;
      }

      const workerName = args[0].trim();

      // Check if the worker exists
      if (!workers.get(workerName)) {
        await groupToRemoveFrom.send(
          `Worker "${workerName}" not found. Check /workers to see all available workers`,
        );
        return;
      }

      const workerToRemove = workers.get(workerName);

      // Get current members
      const currentMembers = await groupToRemoveFrom.members();

      // Check if the worker is in the group
      const memberToRemove = currentMembers.find(
        (member) => member.inboxId === workerToRemove?.client?.inboxId,
      );

      if (!memberToRemove) {
        await groupToRemoveFrom.send(
          `${workerName} is not a member of this group`,
        );
        return;
      }

      // Don't allow removing the sender or the bot
      if (
        memberToRemove.inboxId === message.senderInboxId ||
        memberToRemove.inboxId === client.inboxId
      ) {
        await groupToRemoveFrom.send(
          `Cannot remove ${workerName} from the group`,
        );
        return;
      }

      // Announce removal before removing
      await groupToRemoveFrom.send(
        `Bot :\n Removing ${workerName} from the group.`,
      );

      // Remove the member
      await groupToRemoveFrom.removeMembers([memberToRemove.inboxId]);

      await groupToRemoveFrom.send(`Removed ${workerName} from the group.`);
    } catch (error) {
      console.error("Error removing member from group:", error);
    }
  }

  // List all members in the current group
  async members(
    message: DecodedMessage,
    client: Client,
    workers: WorkerManager,
  ) {
    try {
      await client.conversations.sync();
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );
      // Get current members
      const members = await (conversation as Group).members();

      const memberDetails = members.map((member) => {
        const worker = workers
          .getWorkers()
          .find((p) => p.client?.inboxId === member.inboxId);
        return (
          worker?.name || (member.inboxId == client.inboxId ? "Bot" : "You")
        );
      });

      await conversation?.send(
        `Group members (${members.length}):\n${memberDetails.join("\n")}`,
      );
    } catch (error) {
      console.error("Error listing members:", error);
    }
  }
  async admins(
    message: DecodedMessage,
    client: Client,
    workers: WorkerManager,
  ) {
    try {
      await client.conversations.sync();
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );
      if (!(conversation instanceof Group)) {
        await conversation?.send("Group not found");
        return;
      }
      // Get current members
      await conversation.sync();
      const admins = await conversation.admins;
      const superAdmins = await conversation.superAdmins;
      const allAdmins = [...admins, ...superAdmins];
      const adminDetails = allAdmins.map((admin) => {
        const worker = workers
          .getWorkers()
          .find((p) => p.client?.inboxId === admin);
        return worker?.name || (admin == client.inboxId ? "Bot" : "You");
      });

      await conversation.send(
        `Group admins (${allAdmins.length}):\n${adminDetails.join("\n")}`,
      );
    } catch (error) {
      console.error("Error listing admins:", error);
    }
  }

  // List all active groups
  async groups(message: DecodedMessage, client: Client) {
    try {
      await client.conversations.sync();
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );
      const preGroups = await client.conversations.listGroups();
      const groupsImAdmin = preGroups.filter((group) =>
        group.isSuperAdmin(message.senderInboxId),
      );

      let groupsList = "Active groups:\n";
      for (let i = 0; i < groupsImAdmin.length; i++) {
        const group = groupsImAdmin[i];
        const memberCount = await group
          .members()
          .then((members) => members.length);
        groupsList += `${i + 1}. Name: ${group.name || "Unnamed"} - ID: ${group.id} - Members: ${memberCount}\n`;
      }

      await conversation?.send(groupsList);
    } catch (error) {
      console.error("Error listing groups:", error);
    }
  }
  async blast(
    message: DecodedMessage,
    client: Client,
    args: string[] = [],
    workers: WorkerManager,
  ) {
    try {
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );
      // Extract the message and optional count parameters
      // Format: /blast <message> <count> <repeat>
      // Example: /blast jaja 5 5 - sends "jaja" to 5 workers, 5 times each

      // Get the message from all arguments
      let blastMessage = args.join(" ").trim();

      // Default values
      let countOfWorkers = 5; // Number of workers to message
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
        countOfWorkers = parseInt(secondLastArg);
        // Remove the numbers from the message
        const messageWords = blastMessage.split(" ");
        blastMessage = messageWords.slice(0, messageWords.length - 2).join(" ");
      }

      await conversation?.send(`🔊 Blasting message: ${blastMessage}`);
      for (let i = 0; i < repeatCount; i++) {
        for (const worker of workers.getWorkers().slice(0, countOfWorkers)) {
          const workerGroup = await worker.client?.conversations.newDm(
            message.senderInboxId,
          );
          await conversation?.send(` ${worker.name} just sent you a message`);
          await workerGroup?.send(`${worker.name}:\n${blastMessage}`);
        }
      }
    } catch (error) {
      console.error("Error blasting:", error);
    }
  }

  // Broadcast a message to all participants in all groups
  async broadcast(client: Client, args: string[] = []) {
    try {
      const allGroups = await client.conversations.listGroups();

      const broadcastMessage = args.join(" ").trim();

      for (const group of allGroups) {
        console.log("sending to " + group.name);
        await group.send(`🔊 Broadcast: ${broadcastMessage}`);
      }
    } catch (error) {
      console.error("Error broadcasting:", error);
    }
  }

  // Leave the current group
  async leave(message: DecodedMessage, client: Client) {
    try {
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );
      await (conversation as Group).removeMembers([message.senderInboxId]);

      await conversation?.send(`You, has left the group.`);
    } catch (error) {
      console.error("Error leaving group:", error);
    }
  }

  // Get info about the current group
  async info(message: DecodedMessage, client: Client) {
    try {
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );
      const groupInfo = conversation as Group;
      const members = await groupInfo.members();
      const infoMessage = `Group info:\n- ID: ${groupInfo.id}\n- Name: ${groupInfo.name || "Unnamed"}\n- Description: ${groupInfo.description || "No description"}\n- Created: ${new Date(groupInfo.createdAt).toLocaleString()}\n- Member count: ${members.length}`;

      await conversation?.send(infoMessage);
    } catch (error) {
      console.error("Error getting group info:", error);
    }
  }
}
