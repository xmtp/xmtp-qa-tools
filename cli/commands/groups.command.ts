/**
 * Groups Command - Declarative Version
 * 
 * Create and manage XMTP groups and DMs using the new CLI framework
 */

import { defineCommand, option } from '../framework/index.js';
import { getInboxes } from '../../inboxes/utils.js';
import { getWorkers } from '../../workers/manager.js';
import type { XmtpEnv, Group, Conversation } from '@versions/node-sdk';
import { IdentifierKind } from '@versions/node-sdk';

export default defineCommand({
  name: 'groups',
  description: 'Create and manage XMTP groups and direct messages',
  
  options: {
    operation: option
      .enum(['dm', 'group', 'update'] as const)
      .description('Operation type: create DMs, create group, or update group')
      .required(),
    
    env: option
      .enum(['local', 'dev', 'production'] as const)
      .description('XMTP network environment')
      .default('production' as const),
    
    // DM options
    dmCount: option
      .number()
      .description('Number of DM conversations to create')
      .default(1)
      .min(1),
    
    // Group options
    members: option
      .number()
      .description('Number of members for group')
      .default(5)
      .min(2),
    
    groupName: option
      .string()
      .description('Name for the group')
      .optional(),
    
    groupDescription: option
      .string()
      .description('Description for the group')
      .optional(),
    
    targetAddress: option
      .string()
      .description('Target Ethereum address to add to group')
      .optional(),
    
    // Update options
    groupId: option
      .string()
      .description('Group ID for update operations')
      .optional(),
    
    imageUrl: option
      .string()
      .description('Image URL for group')
      .optional(),
  },
  
  examples: [
    'yarn groups --operation dm --dmCount 3 --env dev',
    'yarn groups --operation group --members 10 --groupName "My Group" --env production',
    'yarn groups --operation update --groupId <id> --groupName "Updated Name"',
  ],
  
  async run({ options }) {
    const { operation, env } = options;
    
    switch (operation) {
      case 'dm':
        return await createDMs(options);
      
      case 'group':
        return await createGroup(options);
      
      case 'update':
        return await updateGroup(options);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  },
});

/**
 * Create DM conversations
 */
async function createDMs(options: any) {
  const { dmCount, env } = options;
  
  console.log(`💬 Creating ${dmCount} direct message conversations`);
  
  const userCount = Math.max(2, dmCount + 1);
  console.log(`👥 Creating ${userCount} users...`);
  
  const workerManager = await getWorkers(userCount, { env: env as XmtpEnv });
  const workers = workerManager.getAll();
  
  const conversations: Conversation[] = [];
  let createdDmCount = 0;
  
  for (let i = 0; i < workers.length && createdDmCount < dmCount; i++) {
    for (let j = i + 1; j < workers.length && createdDmCount < dmCount; j++) {
      try {
        const conversation = await workers[i].client.conversations.newDm(
          workers[j].inboxId,
        );
        conversations.push(conversation);
        createdDmCount++;
        
        const message = `Hello! DM created by XMTP CLI framework.`;
        await conversation.send(message);
        
        console.log(`✅ Created DM ${createdDmCount}: ${workers[i].inboxId.slice(0, 8)}... ↔ ${workers[j].inboxId.slice(0, 8)}...`);
      } catch (error) {
        console.warn(`⚠️  Failed to create DM: ${error}`);
      }
    }
  }
  
  return {
    success: true,
    data: {
      usersCreated: workers.length,
      dmsCreated: conversations.length,
      targetDms: dmCount,
      environment: env,
    },
  };
}

/**
 * Create a group
 */
async function createGroup(options: any) {
  const { members, env, groupName, groupDescription, targetAddress } = options;
  
  console.log(`🏗️  Creating group with ${members} members`);
  
  const workerManager = await getWorkers(1, { env: env as XmtpEnv });
  const mainWorker = workerManager.getAll()[0];
  
  const memberInboxIds = getInboxes(members, 2).map((a) => a.inboxId);
  
  const finalGroupName = groupName || `Group ${Date.now()}`;
  const finalGroupDescription = groupDescription || 'Created by XMTP CLI framework';
  
  const group = (await mainWorker.client.conversations.newGroup(
    memberInboxIds,
    {
      groupName: finalGroupName,
      groupDescription: finalGroupDescription,
    },
  )) as Group;
  
  if (targetAddress) {
    await group.addMembersByIdentifiers([
      {
        identifier: targetAddress,
        identifierKind: IdentifierKind.Ethereum,
      },
    ]);
    console.log(`✅ Added target address: ${targetAddress}`);
  }
  
  await group.sync();
  const groupMembers = await group.members();
  
  await group.send(`Welcome to ${finalGroupName}!`);
  
  console.log(`✅ Group created: ${group.id}`);
  console.log(`   Members: ${groupMembers.length}`);
  console.log(`   URL: https://xmtp.chat/conversations/${group.id}`);
  
  return {
    success: true,
    data: {
      groupId: group.id,
      groupName: group.name,
      memberCount: groupMembers.length,
      environment: env,
      url: `https://xmtp.chat/conversations/${group.id}`,
    },
  };
}

/**
 * Update a group
 */
async function updateGroup(options: any) {
  const { groupId, groupName, groupDescription, imageUrl, env } = options;
  
  if (!groupId) {
    throw new Error('--groupId is required for update operations');
  }
  
  const hasUpdates = groupName || groupDescription || imageUrl;
  if (!hasUpdates) {
    throw new Error('At least one update parameter is required (--groupName, --groupDescription, or --imageUrl)');
  }
  
  const workerManager = await getWorkers(1, { env: env as XmtpEnv });
  const worker = workerManager.getAll()[0];
  
  const group = (await worker.client.conversations.getConversationById(
    groupId,
  )) as Group;
  
  if (!group) {
    throw new Error(`Group not found: ${groupId}`);
  }
  
  const updates: string[] = [];
  
  if (groupName) {
    await group.updateName(groupName);
    updates.push(`name: "${groupName}"`);
  }
  
  if (groupDescription) {
    await group.updateDescription(groupDescription);
    updates.push(`description: "${groupDescription}"`);
  }
  
  if (imageUrl) {
    await group.updateImageUrl(imageUrl);
    updates.push(`image URL: "${imageUrl}"`);
  }
  
  console.log(`✅ Updated group: ${updates.join(', ')}`);
  
  return {
    success: true,
    data: {
      groupId: group.id,
      updates,
      environment: env,
    },
  };
}
