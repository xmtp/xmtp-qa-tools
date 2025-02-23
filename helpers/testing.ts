import { expect } from "vitest";
import { type Persona } from "./personas";

export async function sendMessageTo(sender: Persona, receiver: Persona) {
  try {
    // We'll expect this random message to appear in Joe's stream
    const message = "gm-" + Math.random().toString(36).substring(2, 15);

    // Joe sets up a promise to wait for that exact message
    const messagePromise = receiver.worker?.receiveMessage(message);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(
      `[${sender.name}] Creating DM with ${receiver.name} at ${receiver.client?.accountAddress}`,
    );

    const dmConvo = await sender.client?.conversations.newDm(
      receiver.client?.accountAddress as `0x${string}`,
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));
    const dmId = await dmConvo?.send(message);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("dmId", dmId);

    // Wait for Joe to see it
    const receivedMessage = await messagePromise;
    expect(receivedMessage?.data.content).toBe(message);
    console.log(
      `[${receiver.name}] Message received:`,
      receivedMessage?.data.content,
    );

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

// export async function verifyRemoveRandomMembers(
//   creator: Persona,
//   participants: Persona[],
//   groupId: string,
//   currentMemberCount: number,
// ): Promise<number> {
//   try {
//     const newRandomParticipant = getRandomPersonas(participants, 1)[0];
//     expect(newRandomParticipant).toBeDefined();
//     expect(newRandomParticipant.address).toBeDefined();

//     const membersAfterRemove = await creator.worker?.removeMembers(groupId, [
//       newRandomParticipant.address ?? "",
//     ]);
//     expect(membersAfterRemove).toBe(currentMemberCount - 1);
//     return membersAfterRemove ?? 0;
//   } catch (error) {
//     console.error(
//       `[TEST] Error verifying remove random members: ${error instanceof Error ? error.message : String(error)}`,
//     );
//     throw error;
//   }
// }

// export async function verifyAddRandomMembers(
//   creator: Persona,
//   groupId: string,
//   currentMemberCount: number,
//   env: XmtpEnv,
// ): Promise<number> {
//   try {
//     const newRandomParticipant = await getNewRandomPersona(env);
//     expect(newRandomParticipant).toBeDefined();
//     expect(newRandomParticipant.address).toBeDefined();

//     const membersAfterAdd = await creator.worker?.addMembers(groupId, [
//       newRandomParticipant.address,
//     ]);
//     expect(membersAfterAdd).toBe(currentMemberCount + 1);
//     return membersAfterAdd ?? 0;
//   } catch (error) {
//     console.error(
//       `[TEST] Error verifying add random members: ${error instanceof Error ? error.message : String(error)}`,
//     );
//     throw error;
//   }
// }

// export async function verifyMembersCount(
//   participants: Persona[],
//   groupId: string,
// ): Promise<number> {
//   try {
//     await new Promise((resolve) => setTimeout(resolve, 2000));
//     const checkersCount =
//       Math.floor(Math.random() * (participants.length - 1)) + 1;
//     const checkers = getRandomPersonas(participants, checkersCount);
//     const memberCounts = await Promise.all(
//       checkers.map(async (checker) => {
//         const members = await checker.worker?.getMembers(groupId);
//         return members?.length ?? 0;
//       }),
//     );

//     // Find the most common count
//     const countMap = memberCounts.reduce<Record<number, number>>(
//       (acc, count) => {
//         acc[count] = (acc[count] || 0) + 1;
//         return acc;
//       },
//       {},
//     );

//     // Get the count that appears most frequently
//     const [mostCommonCount] = Object.entries(countMap).sort(
//       ([, a], [, b]) => b - a,
//     )[0];

//     console.log(
//       `[TEST] Member count verified by ${checkers[0].address}: ${mostCommonCount}`,
//     );
//     return parseInt(mostCommonCount);
//   } catch (error) {
//     console.error(
//       `[TEST] Error verifying members count: ${error instanceof Error ? error.message : String(error)}`,
//     );
//     throw error;
//   }
// }

// export async function verifyGroupNameChange(
//   participants: Persona[],
//   groupId: string,
// ) {
//   try {
//     const newGroupName = "name-" + Math.random().toString(36).substring(2, 15);
//     const randomParticipants = getRandomPersonas(participants, 3);
//     const metadataPromises = randomParticipants.map((p) =>
//       p.worker?.receiveMetadata(groupId, newGroupName),
//     );

//     const newRandomParticipant = getRandomPersonas(participants, 1)[0];
//     await newRandomParticipant.worker?.updateGroupName(groupId, newGroupName);

//     const metadataReceived = await Promise.all(metadataPromises);
//     expect(metadataReceived.length).toBe(randomParticipants.length);
//     expect(metadataReceived).toContain(newGroupName);
//   } catch (error) {
//     console.error(
//       `[TEST] Error verifying group name: ${error instanceof Error ? error.message : String(error)}`,
//     );
//     throw error;
//   }
// }

// export async function verifyStreams(
//   creator: Persona,
//   allParticipants: Persona[],
//   groupId: string,
//   listenerCount: number,
// ) {
//   try {
//     const message = `gm-${Math.random().toString(36).substring(2, 8)}`;

//     const recipients = getRandomPersonas(allParticipants, listenerCount);
//     // Set up message reception streams
//     const receivePromises = recipients.map(async (recipient) => {
//       if (recipient.address !== creator.address) {
//         return recipient.worker?.receiveMessage(groupId, [message]);
//       }
//     });

//     // Send messages
//     await new Promise((resolve) => setTimeout(resolve, 1000));

//     await creator.worker?.sendMessage(groupId, message);

//     // Verify reception
//     const receivedMessages = await Promise.all(receivePromises);
//     const validMessages = receivedMessages.filter((msg) =>
//       msg?.includes(message),
//     );
//     const percentageMissed =
//       (receivedMessages.length - validMessages.length) /
//       receivedMessages.length;
//     const successPercentage = (1 - percentageMissed) * 100;

//     if (successPercentage < 100) {
//       console.warn(
//         `[TEST] Success percentage: ${successPercentage}%, missed: ${percentageMissed * 100}%`,
//       );
//     }
//     return {
//       receivedMessages,
//       validMessages,
//       successPercentage,
//     };
//   } catch (error) {
//     console.error(
//       `[TEST] Error verifying streams: ${error instanceof Error ? error.message : String(error)}`,
//     );
//     return {
//       receivedMessages: [],
//       validMessages: [],
//     };
//   }
//   async newDM(senderAddresses: string): Promise<string> {
//     try {
//       console.time(`[${this.nameId}] - create DM`);
//       const dm = await this.client.conversations.newDm(senderAddresses);
//       console.timeEnd(`[${this.nameId}] - create DM`);
//       return dm.id;
//     } catch (error) {
//       console.error(
//         "error:newDM()",
//         error instanceof Error ? error.message : String(error),
//       );
//       return "";
//     }
//   }
//   async newGroup(senderAddresses: string[]): Promise<string> {
//     try {
//       console.log(`[${this.nameId}] - creating group`);
//       console.time(`[${this.nameId}] - create group`);
//       const group = await this.client.conversations.newGroup(senderAddresses);
//       console.timeEnd(`[${this.nameId}] - create group`);
//       console.log(`[${this.nameId}] - group created`);
//       console.log(`[${this.nameId}] - updating group name`);
//       console.time(`[${this.nameId}] - update group name`);
//       await group.updateName(
//         "Test Group" + Math.random().toString(36).substring(2, 15),
//       );
//       console.timeEnd(`[${this.nameId}] - update group name`);
//       console.log(`[${this.nameId}] - adding super admin`);
//       console.time(`[${this.nameId}] - add super admin`);
//       await group.addSuperAdmin(senderAddresses[0]);
//       console.timeEnd(`[${this.nameId}] - add super admin`);
//       console.log(`[${this.nameId}] - super admin added`);
//       return group.id;
//     } catch (error) {
//       console.error(
//         "error:newGroup()",
//         error instanceof Error ? error.message : String(error),
//       );
//       return "";
//     }
//   }

//   async send(groupId: string, message: string): Promise<boolean> {
//     try {
//       console.log(`[${this.nameId}] - syncing`);
//       console.time(`[${this.nameId}] - sync`);
//       await this.client.conversations.sync();
//       console.timeEnd(`[${this.nameId}] - sync`);
//       console.log(`[${this.nameId}] - synced`);
//       const conversation =
//         this.client.conversations.getConversationById(groupId);
//       if (!conversation) {
//         throw new Error("Conversation not found");
//       }
//       console.log(`[${this.nameId}] - sending message`);
//       console.time(`[${this.nameId}] - send`);
//       await conversation.send(message);
//       console.timeEnd(`[${this.nameId}] - send`);
//       console.log(`[${this.nameId}] - message sent`);
//       return true;
//     } catch (error) {
//       console.error(
//         "error:send()",
//         error instanceof Error ? error.message : String(error),
//       );
//       return false;
//     }
//   }

//   async updateName(groupId: string, newGroupName: string) {
//     try {
//       console.log(`[${this.nameId}] - syncing`);
//       console.time(`[${this.nameId}] - sync`);
//       await this.client.conversations.sync();
//       console.timeEnd(`[${this.nameId}] - sync`);
//       console.log(`[${this.nameId}] - synced`);
//       const conversation =
//         this.client.conversations.getConversationById(groupId);
//       if (!conversation) {
//         throw new Error("Conversation not found");
//       }
//       console.log(`[${this.nameId}] - syncing conversation`);
//       console.time(`[${this.nameId}] - sync conversation`);
//       await conversation.sync();
//       console.timeEnd(`[${this.nameId}] - sync conversation`);
//       console.log(`[${this.nameId}] - synced conversation`);
//       await conversation.updateName(newGroupName);
//       return conversation.name;
//     } catch (error) {
//       console.error(
//         "error:updateName()",
//         error instanceof Error ? error.message : String(error),
//       );
//       return false;
//     }
//   }
//   async isMember(groupId: string, memberAddress: string) {
//     try {
//       console.log(`[${this.nameId}] - syncing`);
//       console.time(`[${this.nameId}] - sync`);
//       await this.client.conversations.sync();
//       console.timeEnd(`[${this.nameId}] - sync`);
//       console.log(`[${this.nameId}] - synced`);
//       const conversation =
//         this.client.conversations.getConversationById(groupId);
//       if (!conversation) {
//         throw new Error("Conversation not found");
//       }
//       console.log(`[${this.nameId}] - syncing conversation`);
//       console.time(`[${this.nameId}] - sync conversation`);
//       await conversation.sync();
//       console.timeEnd(`[${this.nameId}] - sync conversation`);
//       console.log(`[${this.nameId}] - synced conversation`);
//       const members = await conversation.members();
//       return members.some((member) =>
//         member.accountAddresses.some(
//           (address) => address.toLowerCase() === memberAddress.toLowerCase(),
//         ),
//       );
//     } catch (error) {
//       console.error(
//         "error:isMember()",
//         error instanceof Error ? error.message : String(error),
//       );
//       return false;
//     }
//   }
//   async messages(groupId: string): Promise<string[]> {
//     try {
//       console.log(`[${this.nameId}] - syncing`);
//       console.time(`[${this.nameId}] - sync`);
//       await this.client.conversations.sync();
//       console.timeEnd(`[${this.nameId}] - sync`);
//       console.log(`[${this.nameId}] - synced`);
//       const conversation =
//         this.client.conversations.getConversationById(groupId);
//       if (!conversation) {
//         throw new Error("Conversation not found");
//       }
//       console.log(`[${this.nameId}] - syncing conversation`);
//       console.time(`[${this.nameId}] - sync conversation`);
//       await conversation.sync();
//       console.timeEnd(`[${this.nameId}] - sync conversation`);
//       console.log(`[${this.nameId}] - synced conversation`);
//       const returnedMessages: string[] = [];
//       const messages = await conversation.messages();
//       for (const message of messages) {
//         if (message.contentType?.typeId === "text") {
//           returnedMessages.push(message.content as string);
//         }
//       }
//       return returnedMessages;
//     } catch (error) {
//       console.error(
//         "error:messages()",
//         error instanceof Error ? error.message : String(error),
//       );
//       return [];
//     }
//   }
//   async getMembers(groupId: string) {
//     try {
//       console.log(`[${this.nameId}] - syncing`);
//       console.time(`[${this.nameId}] - sync`);
//       await this.client.conversations.sync();
//       console.timeEnd(`[${this.nameId}] - sync`);
//       console.log(`[${this.nameId}] - synced`);
//       const conversation =
//         this.client.conversations.getConversationById(groupId);
//       if (!conversation) {
//         throw new Error("Conversation not found");
//       }
//       console.log(`[${this.nameId}] - syncing conversation`);
//       console.time(`[${this.nameId}] - sync conversation`);
//       await conversation.sync();
//       console.timeEnd(`[${this.nameId}] - sync conversation`);
//       console.log(`[${this.nameId}] - synced conversation`);
//       const members = [];
//       for (const member of await conversation.members()) {
//         members.push(member.accountAddresses);
//       }
//       return members;
//     } catch (error) {
//       console.error(
//         "error:getMembers()",
//         error instanceof Error ? error.message : String(error),
//       );
//       return false;
//     }
//   }
//   async removeMembers(groupId: string, memberAddresses: string[]) {
//     try {
//       console.log(`[${this.nameId}] - syncing`);
//       console.time(`[${this.nameId}] - sync`);
//       await this.client.conversations.sync();
//       console.timeEnd(`[${this.nameId}] - sync`);
//       console.log(`[${this.nameId}] - synced`);
//       const conversation =
//         this.client.conversations.getConversationById(groupId);
//       if (!conversation) {
//         throw new Error("Conversation not found");
//       }
//       console.log(`[${this.nameId}] - removing members`);
//       console.time(`[${this.nameId}] - remove members`);
//       await conversation.removeMembers(memberAddresses);
//       console.timeEnd(`[${this.nameId}] - remove members`);
//       console.log(`[${this.nameId}] - members removed`);
//       console.log(`[${this.nameId}] - syncing conversation`);
//       console.time(`[${this.nameId}] - sync conversation`);
//       await conversation.sync();
//       console.timeEnd(`[${this.nameId}] - sync conversation`);
//       console.log(`[${this.nameId}] - synced conversation`);
//       return (await conversation.members()).length;
//     } catch (error) {
//       console.error(
//         "error:removeMembers()",
//         error instanceof Error ? error.message : String(error),
//       );
//       return false;
//     }
//   }
//   async addMembers(groupId: string, memberAddresses: string[]) {
//     try {
//       console.log(`[${this.nameId}] - syncing`);
//       console.time(`[${this.nameId}] - sync`);
//       await this.client.conversations.sync();
//       console.timeEnd(`[${this.nameId}] - sync`);
//       console.log(`[${this.nameId}] - synced`);
//       const conversation =
//         this.client.conversations.getConversationById(groupId);
//       if (!conversation) {
//         throw new Error("Conversation not found");
//       }
//       console.log(`[${this.nameId}] - adding members`);
//       console.time(`[${this.nameId}] - add members`);
//       await conversation.addMembers(memberAddresses);
//       console.timeEnd(`[${this.nameId}] - add members`);
//       console.log(`[${this.nameId}] - members added`);
//       console.log(`[${this.nameId}] - syncing conversation`);
//       console.time(`[${this.nameId}] - sync conversation`);
//       await conversation.sync();
//       return (await conversation.members()).length;
//     } catch (error) {
//       console.error(
//         "error:addMembers()",
//         error instanceof Error ? error.message : String(error),
//       );
//       return false;
//     }
//   }
//   async receiveMetadata(groupId: string, expectedMetadata: string) {
//     try {
//       console.log(`[${this.nameId}] - syncing`);
//       console.time(`[${this.nameId}] - sync`);
//       await this.client.conversations.sync();
//       console.timeEnd(`[${this.nameId}] - sync`);
//       console.log(`[${this.nameId}] - synced`);
//       const conversation =
//         this.client.conversations.getConversationById(groupId);

//       if (!conversation) {
//         throw new Error("Conversation not found");
//       }
//       console.log(`[${this.nameId}] - syncing conversation`);
//       console.time(`[${this.nameId}] - sync conversation`);
//       await conversation.sync();
//       console.timeEnd(`[${this.nameId}] - sync conversation`);
//       console.log(`[${this.nameId}] - synced conversation`);
//       if (conversation.name === expectedMetadata) {
//         return conversation.name;
//       }
//       return false;
//     } catch (error) {
//       console.error(
//         "error:receiveMetadata()",
//         error instanceof Error ? error.message : String(error),
//       );
//       return false;
//     }
//   }
// }
