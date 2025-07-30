import "dotenv/config";
import fs from "fs";
import path from "path";
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { IdentifierKind, type XmtpEnv } from "@workers/versions";
import { Client } from "@xmtp/node-sdk";

// MOCK AGENT ADDRESS 0x7723d790A5e00b650BF146A0961F8Bb148F0450C

// Mock data structures
interface MockGroup {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  members: MockMember[];
  messages: MockMessage[];
  admins: string[];
  superAdmins: string[];
  createdAt: Date;
}

interface MockMember {
  inboxId: string;
  address?: string;
  installationIds: string[];
  permissionLevel: "member" | "admin" | "superAdmin";
}

interface MockMessage {
  id: string;
  content: string;
  senderInboxId: string;
  sentAt: Date;
  conversationId: string;
}

interface MockDm {
  id: string;
  peerInboxId: string;
  messages: MockMessage[];
  createdAt: Date;
}

interface MockClient {
  inboxId: string;
  installationId: string;
  address: string;
  env: XmtpEnv;
}

class MockXmtpAgent {
  private groups: Map<string, MockGroup> = new Map();
  private dms: Map<string, MockDm> = new Map();
  private clients: Map<string, MockClient> = new Map();
  private messageCounter = 0;
  private groupCounter = 0;
  private dmCounter = 0;

  constructor(private env: XmtpEnv = "production") {}

  get environment(): XmtpEnv {
    return this.env;
  }

  // Client management
  createClient(inboxId: string, address: string): MockClient {
    const client: MockClient = {
      inboxId,
      installationId: `mock-installation-${inboxId}`,
      address,
      env: this.env,
    };
    this.clients.set(inboxId, client);
    console.log(`✅ Created mock client: ${inboxId} (${address})`);
    return client;
  }

  // Read-only: Get real XMTP client state for verification
  async getRealXmtpState(clientName: string): Promise<{
    client: Client;
    conversations: any[];
    groups: any[];
    dms: any[];
  }> {
    const walletKey = process.env.WALLET_KEY;
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!walletKey || !encryptionKey) {
      throw new Error(
        "WALLET_KEY and ENCRYPTION_KEY must be set in environment",
      );
    }

    const signer = createSigner(walletKey as `0x${string}`);
    const dbEncryptionKey = getEncryptionKeyFromHex(encryptionKey);

    const client = await Client.create(signer, {
      dbEncryptionKey,
      env: this.env,
    });

    console.log(
      `📖 Reading XMTP state for client: ${clientName} (${client.inboxId})`,
    );

    // Sync conversations to get latest state
    await client.conversations.sync();

    // Get all conversations
    const conversations = await client.conversations.list();
    const groups = conversations.filter(conv => conv.constructor.name === 'Group');
    const dms = conversations.filter(conv => conv.constructor.name === 'Dm');

    console.log(`📊 Found ${conversations.length} conversations (${groups.length} groups, ${dms.length} DMs)`);

    return {
      client,
      conversations,
      groups,
      dms
    };
  }

  // Group operations
  createGroup(
    creatorInboxId: string,
    memberInboxIds: string[],
    options: {
      groupName?: string;
      groupDescription?: string;
      groupImageUrlSquare?: string;
    } = {},
  ): MockGroup {
    const groupId = `mock-group-${++this.groupCounter}`;
    const group: MockGroup = {
      id: groupId,
      name: options.groupName || `Test Group ${this.groupCounter}`,
      description: options.groupDescription,
      imageUrl: options.groupImageUrlSquare,
      members: [],
      messages: [],
      admins: [creatorInboxId],
      superAdmins: [creatorInboxId],
      createdAt: new Date(),
    };

    // Add creator as first member
    group.members.push({
      inboxId: creatorInboxId,
      address: this.clients.get(creatorInboxId)?.address,
      installationIds: [this.clients.get(creatorInboxId)?.installationId || ""],
      permissionLevel: "superAdmin",
    });

    // Add other members
    for (const inboxId of memberInboxIds) {
      if (inboxId !== creatorInboxId) {
        group.members.push({
          inboxId,
          address: this.clients.get(inboxId)?.address,
          installationIds: [this.clients.get(inboxId)?.installationId || ""],
          permissionLevel: "member",
        });
      }
    }

    this.groups.set(groupId, group);
    console.log(`✅ Created mock group: ${group.name} (${groupId})`);
    console.log(`   Members: ${group.members.length}`);
    console.log(`   Creator: ${creatorInboxId}`);
    this.saveState();
    return group;
  }

  addMemberToGroup(
    groupId: string,
    memberInboxId: string,
    identifier?: { identifier: string; identifierKind: IdentifierKind },
  ): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      console.log(`❌ Group not found: ${groupId}`);
      return false;
    }

    // Check if member already exists
    if (group.members.some((m) => m.inboxId === memberInboxId)) {
      console.log(`⚠️  Member already in group: ${memberInboxId}`);
      return false;
    }

    const member: MockMember = {
      inboxId: memberInboxId,
      address:
        identifier?.identifierKind === IdentifierKind.Ethereum
          ? identifier.identifier
          : undefined,
      installationIds: [this.clients.get(memberInboxId)?.installationId || ""],
      permissionLevel: "member",
    };

    group.members.push(member);
    console.log(`✅ Added member to group: ${memberInboxId} -> ${group.name}`);
    return true;
  }

  sendMessageToGroup(
    groupId: string,
    senderInboxId: string,
    content: string,
  ): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      console.log(`❌ Group not found: ${groupId}`);
      return false;
    }

    const message: MockMessage = {
      id: `mock-message-${++this.messageCounter}`,
      content,
      senderInboxId,
      sentAt: new Date(),
      conversationId: groupId,
    };

    group.messages.push(message);
    console.log(`✅ Sent message to group ${group.name}: "${content}"`);
    return true;
  }

  // DM operations
  createDm(creatorInboxId: string, peerInboxId: string): MockDm {
    const dmId = `mock-dm-${++this.dmCounter}`;
    const dm: MockDm = {
      id: dmId,
      peerInboxId,
      messages: [],
      createdAt: new Date(),
    };

    this.dms.set(dmId, dm);
    console.log(`✅ Created mock DM: ${creatorInboxId} ↔ ${peerInboxId}`);
    return dm;
  }

  sendMessageToDm(
    dmId: string,
    senderInboxId: string,
    content: string,
  ): boolean {
    const dm = this.dms.get(dmId);
    if (!dm) {
      console.log(`❌ DM not found: ${dmId}`);
      return false;
    }

    const message: MockMessage = {
      id: `mock-message-${++this.messageCounter}`,
      content,
      senderInboxId,
      sentAt: new Date(),
      conversationId: dmId,
    };

    dm.messages.push(message);
    console.log(`✅ Sent message to DM: "${content}"`);
    return true;
  }

  // Group management
  updateGroupName(groupId: string, newName: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      console.log(`❌ Group not found: ${groupId}`);
      return false;
    }

    const oldName = group.name;
    group.name = newName;
    console.log(`✅ Updated group name: "${oldName}" -> "${newName}"`);
    return true;
  }

  updateGroupDescription(groupId: string, newDescription: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      console.log(`❌ Group not found: ${groupId}`);
      return false;
    }

    group.description = newDescription;
    console.log(`✅ Updated group description: "${newDescription}"`);
    return true;
  }

  updateGroupImage(groupId: string, newImageUrl: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      console.log(`❌ Group not found: ${groupId}`);
      return false;
    }

    group.imageUrl = newImageUrl;
    console.log(`✅ Updated group image: ${newImageUrl}`);
    return true;
  }

  addAdmin(groupId: string, memberInboxId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      console.log(`❌ Group not found: ${groupId}`);
      return false;
    }

    if (!group.admins.includes(memberInboxId)) {
      group.admins.push(memberInboxId);
      console.log(`✅ Added admin: ${memberInboxId} to ${group.name}`);
    } else {
      console.log(`⚠️  Already admin: ${memberInboxId}`);
    }
    return true;
  }

  // Reporting methods
  listGroups(): void {
    console.log(`\n📊 MOCK AGENT STATE - GROUPS (${this.groups.size} total):`);
    console.log(`Environment: ${this.env}`);
    console.log("─".repeat(80));

    if (this.groups.size === 0) {
      console.log("No groups created yet");
      return;
    }

    for (const [groupId, group] of this.groups) {
      console.log(`\n🏗️  Group: ${group.name}`);
      console.log(`   ID: ${groupId}`);
      console.log(`   Description: ${group.description || "No description"}`);
      console.log(`   Image: ${group.imageUrl || "No image"}`);
      console.log(`   Created: ${group.createdAt.toISOString()}`);
      console.log(`   Members: ${group.members.length}`);
      console.log(`   Messages: ${group.messages.length}`);
      console.log(`   Admins: ${group.admins.length}`);
      console.log(`   Super Admins: ${group.superAdmins.length}`);

      if (group.members.length > 0) {
        console.log(`   Member List:`);
        for (const member of group.members) {
          const role = group.superAdmins.includes(member.inboxId)
            ? "SUPER_ADMIN"
            : group.admins.includes(member.inboxId)
              ? "ADMIN"
              : "MEMBER";
          console.log(
            `     - ${member.inboxId} (${member.address || "no address"}) [${role}]`,
          );
        }
      }

      if (group.messages.length > 0) {
        console.log(`   Recent Messages:`);
        const recentMessages = group.messages.slice(-3); // Last 3 messages
        for (const message of recentMessages) {
          console.log(
            `     [${message.sentAt.toISOString()}] ${message.senderInboxId}: "${message.content}"`,
          );
        }
      }
    }
  }

  listDms(): void {
    console.log(`\n📊 MOCK AGENT STATE - DMs (${this.dms.size} total):`);
    console.log("─".repeat(80));

    if (this.dms.size === 0) {
      console.log("No DMs created yet");
      return;
    }

    for (const [dmId, dm] of this.dms) {
      console.log(`\n💬 DM: ${dmId}`);
      console.log(`   Peer: ${dm.peerInboxId}`);
      console.log(`   Created: ${dm.createdAt.toISOString()}`);
      console.log(`   Messages: ${dm.messages.length}`);

      if (dm.messages.length > 0) {
        console.log(`   Recent Messages:`);
        const recentMessages = dm.messages.slice(-3); // Last 3 messages
        for (const message of recentMessages) {
          console.log(
            `     [${message.sentAt.toISOString()}] ${message.senderInboxId}: "${message.content}"`,
          );
        }
      }
    }
  }

  listClients(): void {
    console.log(
      `\n📊 MOCK AGENT STATE - CLIENTS (${this.clients.size} total):`,
    );
    console.log("─".repeat(80));

    if (this.clients.size === 0) {
      console.log("No clients created yet");
      return;
    }

    for (const [inboxId, client] of this.clients) {
      console.log(`\n👤 Client: ${inboxId}`);
      console.log(`   Address: ${client.address}`);
      console.log(`   Installation ID: ${client.installationId}`);
      console.log(`   Environment: ${client.env}`);
    }
  }

  getState(): {
    groups: MockGroup[];
    dms: MockDm[];
    clients: MockClient[];
    stats: {
      totalGroups: number;
      totalDms: number;
      totalClients: number;
      totalMessages: number;
    };
  } {
    const totalMessages =
      Array.from(this.groups.values()).reduce(
        (sum, group) => sum + group.messages.length,
        0,
      ) +
      Array.from(this.dms.values()).reduce(
        (sum, dm) => sum + dm.messages.length,
        0,
      );

    return {
      groups: Array.from(this.groups.values()),
      dms: Array.from(this.dms.values()),
      clients: Array.from(this.clients.values()),
      stats: {
        totalGroups: this.groups.size,
        totalDms: this.dms.size,
        totalClients: this.clients.size,
        totalMessages,
      },
    };
  }

  // Utility methods
  findGroupByName(name: string): MockGroup | undefined {
    return Array.from(this.groups.values()).find((g) => g.name === name);
  }

  findGroupById(id: string): MockGroup | undefined {
    return this.groups.get(id);
  }

  getClientByInboxId(inboxId: string): MockClient | undefined {
    return this.clients.get(inboxId);
  }

  // Reset state for testing
  reset(): void {
    this.groups.clear();
    this.dms.clear();
    this.clients.clear();
    this.messageCounter = 0;
    this.groupCounter = 0;
    this.dmCounter = 0;
    console.log("🔄 Mock agent state reset");
    this.saveState();
  }

  // Persistence methods
  private getStateFilePath(): string {
    const stateDir = path.join(process.cwd(), ".data", "mock-agent");
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    return path.join(stateDir, `state-${this.env}.json`);
  }

  saveState(): void {
    const state = {
      groups: Array.from(this.groups.entries()),
      dms: Array.from(this.dms.entries()),
      clients: Array.from(this.clients.entries()),
      messageCounter: this.messageCounter,
      groupCounter: this.groupCounter,
      dmCounter: this.dmCounter,
      env: this.env,
    };

    try {
      fs.writeFileSync(this.getStateFilePath(), JSON.stringify(state, null, 2));
    } catch (error) {
      console.warn("⚠️  Failed to save mock agent state:", error);
    }
  }

  loadState(): void {
    try {
      const statePath = this.getStateFilePath();
      if (fs.existsSync(statePath)) {
        const stateData = JSON.parse(fs.readFileSync(statePath, "utf8"));

        // Reconstruct groups with proper date objects
        const groups = new Map();
        if (stateData.groups) {
          for (const [id, groupData] of stateData.groups) {
            const group = groupData;
            group.createdAt = new Date(group.createdAt);
            if (group.messages) {
              group.messages = group.messages.map((msg: any) => ({
                ...msg,
                sentAt: new Date(msg.sentAt),
              }));
            }
            groups.set(id, group);
          }
        }
        this.groups = groups;

        // Reconstruct DMs with proper date objects
        const dms = new Map();
        if (stateData.dms) {
          for (const [id, dmData] of stateData.dms) {
            const dm = dmData;
            dm.createdAt = new Date(dm.createdAt);
            if (dm.messages) {
              dm.messages = dm.messages.map((msg: any) => ({
                ...msg,
                sentAt: new Date(msg.sentAt),
              }));
            }
            dms.set(id, dm);
          }
        }
        this.dms = dms;

        this.clients = new Map(stateData.clients || []);
        this.messageCounter = stateData.messageCounter || 0;
        this.groupCounter = stateData.groupCounter || 0;
        this.dmCounter = stateData.dmCounter || 0;

        console.log("📂 Loaded mock agent state from file");
      }
    } catch (error) {
      console.warn("⚠️  Failed to load mock agent state:", error);
    }
  }
}

// Global mock agent instance
let globalMockAgent: MockXmtpAgent | null = null;

export function getMockAgent(env: XmtpEnv = "production"): MockXmtpAgent {
  if (!globalMockAgent || globalMockAgent.environment !== env) {
    globalMockAgent = new MockXmtpAgent(env);
    globalMockAgent.loadState();
  }
  return globalMockAgent;
}

export function resetMockAgent(): void {
  if (globalMockAgent) {
    globalMockAgent.reset();
  }
}

// CLI Configuration
interface MockConfig {
  operation: string;
  env: string;
  // Group operations
  groupName?: string;
  groupDescription?: string;
  members?: number;
  targetAddress?: string;
  groupId?: string;
  newName?: string;
  newDescription?: string;
  imageUrl?: string;
  // DM operations
  dmCount?: number;
  // Message operations
  messageCount?: number;
  messageContent?: string;
  // Client operations
  clientInboxId?: string;
  clientAddress?: string;
  // Utility
  list?: boolean;
  reset?: boolean;
}

function showHelp() {
  console.log(`
XMTP Mock Agent CLI - Test XMTP operations with mock agent

USAGE:
  yarn mock <operation> [options]

OPERATIONS:
  client                    Create a mock client
  verify                    Read real XMTP state for verification
  group                     Create a mock group
  dm                        Create mock DMs
  message                   Send messages to groups/DMs
  update                    Update group metadata
  add-member                Add member to group
  add-admin                 Add admin to group
  list                      List all state
  reset                     Reset mock agent state

OPTIONS:
  --env <environment>       XMTP environment (local, dev, production) [default: production]
  --group-name <name>       Group name for group operations
  --group-desc <desc>       Group description
  --members <count>         Number of random members for groups [default: 5]
  --target <address>        Target address to add to group
  --group-id <id>           Group ID for update/add operations
  --new-name <name>         New group name for update operations
  --new-description <desc>  New group description for update operations
  --image-url <url>         New group image URL for update operations
  --dm-count <number>       Number of DMs to create [default: 1]
  --message-count <number>  Number of messages to send [default: 1]
  --message-content <text>  Message content to send
  --client-inbox <id>       Client inbox ID for operations
  --client-address <addr>   Client address for operations
  --list                    List state after operation
  --reset                   Reset state before operation
  -h, --help               Show this help message

EXAMPLES:
  # Create a group with name "fabri 2" in prod, add address "MOCK ADDRESS ON PROD" and send 10 messages
  yarn mock group --group-name "fabri 2" --target "MOCK ADDRESS ON PROD" --env production
  yarn mock message --message-count 10 --message-content "Hello from mock agent!"

  # Create clients first, then create group
  yarn mock client --client-inbox "user1" --client-address "0x123..."
  yarn mock client --client-inbox "user2" --client-address "0x456..."
  yarn mock group --group-name "Test Group" --members 2

  # Update group metadata
  yarn mock update --group-id "mock-group-1" --new-name "Updated Name" --new-description "New description"

  # List current state
  yarn mock list

  # Reset everything and start fresh
  yarn mock reset

ENVIRONMENT VARIABLES:
  XMTP_ENV             Default environment

For more information, see: cli/readme.md
`);
}

function parseArgs(): MockConfig {
  const args = process.argv.slice(2);
  const config: MockConfig = {
    operation: "list",
    env: process.env.XMTP_ENV ?? "production",
    members: 5,
    dmCount: 1,
    messageCount: 1,
    messageContent: "Hello from mock agent!",
  };

  // First argument is the operation
  if (args.length > 0 && !args[0].startsWith("--")) {
    config.operation = args[0];
    args.shift(); // Remove operation from args
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    } else if (arg === "--env" && nextArg) {
      config.env = nextArg;
      i++;
    } else if (arg === "--group-name" && nextArg) {
      config.groupName = nextArg;
      i++;
    } else if (arg === "--group-desc" && nextArg) {
      config.groupDescription = nextArg;
      i++;
    } else if (arg === "--members" && nextArg) {
      config.members = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--target" && nextArg) {
      config.targetAddress = nextArg;
      i++;
    } else if (arg === "--group-id" && nextArg) {
      config.groupId = nextArg;
      i++;
    } else if (arg === "--new-name" && nextArg) {
      config.newName = nextArg;
      i++;
    } else if (arg === "--new-description" && nextArg) {
      config.newDescription = nextArg;
      i++;
    } else if (arg === "--image-url" && nextArg) {
      config.imageUrl = nextArg;
      i++;
    } else if (arg === "--dm-count" && nextArg) {
      config.dmCount = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--message-count" && nextArg) {
      config.messageCount = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--message-content" && nextArg) {
      config.messageContent = nextArg;
      i++;
    } else if (arg === "--client-inbox" && nextArg) {
      config.clientInboxId = nextArg;
      i++;
    } else if (arg === "--client-address" && nextArg) {
      config.clientAddress = nextArg;
      i++;
    } else if (arg === "--list") {
      config.list = true;
    } else if (arg === "--reset") {
      config.reset = true;
    }
  }

  return config;
}

// Operation: Create client
async function runClientOperation(config: MockConfig): Promise<void> {
  if (!config.clientInboxId || !config.clientAddress) {
    console.error(
      "❌ Error: --client-inbox and --client-address are required for client operations",
    );
    return;
  }

  const mockAgent = getMockAgent(config.env as any);

  if (config.reset) {
    mockAgent.reset();
  }

  mockAgent.createClient(config.clientInboxId, config.clientAddress);

  if (config.list) {
    mockAgent.listClients();
  }
}

// Operation: Verify real XMTP state
async function runVerifyOperation(config: MockConfig): Promise<void> {
  const mockAgent = getMockAgent(config.env as any);

  try {
    const clientName = config.clientInboxId || "ai-agent";
    const realState = await mockAgent.getRealXmtpState(clientName);
    
    console.log(`\n🔍 REAL XMTP STATE VERIFICATION:`);
    console.log(`   Client Inbox ID: ${realState.client.inboxId}`);
    console.log(`   Environment: ${config.env}`);
    console.log(`   Total Conversations: ${realState.conversations.length}`);
    console.log(`   Groups: ${realState.groups.length}`);
    console.log(`   DMs: ${realState.dms.length}`);
    
    // Show group details
    if (realState.groups.length > 0) {
      console.log(`\n🏗️  REAL GROUPS:`);
      for (const group of realState.groups) {
        console.log(`   - ${group.name || 'Unnamed'} (${group.id})`);
        const members = await group.members();
        console.log(`     Members: ${members.length}`);
      }
    }
    
    // Show DM details
    if (realState.dms.length > 0) {
      console.log(`\n💬 REAL DMs:`);
      for (const dm of realState.dms) {
        console.log(`   - DM with ${dm.peerInboxId} (${dm.id})`);
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to verify real XMTP state: ${errorMessage}`);
  }
}

// Operation: Create group
async function runGroupOperation(config: MockConfig): Promise<void> {
  const mockAgent = getMockAgent(config.env as any);

  if (config.reset) {
    mockAgent.reset();
  }

  // Create some default clients if none exist
  const state = mockAgent.getState();
  if (state.clients.length === 0) {
    console.log("📝 Creating default clients for group operation...");
    mockAgent.createClient(
      "creator",
      "0x1234567890123456789012345678901234567890",
    );
    for (let i = 0; i < (config.members || 5); i++) {
      mockAgent.createClient(
        `member${i}`,
        `0x${(i + 1).toString().padStart(40, "0")}`,
      );
    }
  }

  const creatorInboxId = "creator";
  const memberInboxIds = Array.from(
    { length: config.members || 5 },
    (_, i) => `member${i}`,
  );

  const group = mockAgent.createGroup(creatorInboxId, memberInboxIds, {
    groupName: config.groupName,
    groupDescription: config.groupDescription,
  });

  // Add target address if specified
  if (config.targetAddress) {
    console.log(`🎯 Adding target address: ${config.targetAddress}`);
    mockAgent.addMemberToGroup(group.id, "target-member", {
      identifier: config.targetAddress,
      identifierKind: IdentifierKind.Ethereum,
    });
  }

  if (config.list) {
    mockAgent.listGroups();
  }
}

// Operation: Create DMs
async function runDmOperation(config: MockConfig): Promise<void> {
  const mockAgent = getMockAgent(config.env as any);

  if (config.reset) {
    mockAgent.reset();
  }

  // Create some default clients if none exist
  const state = mockAgent.getState();
  if (state.clients.length === 0) {
    console.log("📝 Creating default clients for DM operation...");
    mockAgent.createClient(
      "user1",
      "0x1111111111111111111111111111111111111111",
    );
    mockAgent.createClient(
      "user2",
      "0x2222222222222222222222222222222222222222",
    );
  }

  const dmCount = config.dmCount || 1;
  console.log(`💬 Creating ${dmCount} direct message conversations`);

  for (let i = 0; i < dmCount; i++) {
    mockAgent.createDm("user1", "user2");
  }

  if (config.list) {
    mockAgent.listDms();
  }
}

// Operation: Send messages
async function runMessageOperation(config: MockConfig): Promise<void> {
  const mockAgent = getMockAgent(config.env as any);
  const state = mockAgent.getState();

  if (state.groups.length === 0 && state.dms.length === 0) {
    console.error("❌ Error: No groups or DMs exist to send messages to");
    console.log(
      "   Create groups or DMs first using: yarn mock group or yarn mock dm",
    );
    return;
  }

  const messageCount = config.messageCount || 1;
  const messageContent = config.messageContent || "Hello from mock agent!";

  console.log(`📤 Sending ${messageCount} messages...`);

  // Send to groups
  for (const group of state.groups) {
    for (let i = 0; i < messageCount; i++) {
      const content =
        messageCount > 1 ? `${messageContent} (${i + 1})` : messageContent;
      mockAgent.sendMessageToGroup(group.id, "creator", content);
    }
  }

  // Send to DMs
  for (const dm of state.dms) {
    for (let i = 0; i < messageCount; i++) {
      const content =
        messageCount > 1 ? `${messageContent} (${i + 1})` : messageContent;
      mockAgent.sendMessageToDm(dm.id, "user1", content);
    }
  }

  if (config.list) {
    mockAgent.listGroups();
    mockAgent.listDms();
  }
}

// Operation: Update group
async function runUpdateOperation(config: MockConfig): Promise<void> {
  if (!config.groupId) {
    console.error("❌ Error: --group-id is required for update operations");
    return;
  }

  const mockAgent = getMockAgent(config.env as any);
  const group = mockAgent.findGroupById(config.groupId);

  if (!group) {
    console.error(`❌ Group not found: ${config.groupId}`);
    console.log("   Available groups:");
    mockAgent.listGroups();
    return;
  }

  if (config.newName) {
    mockAgent.updateGroupName(config.groupId, config.newName);
  }

  if (config.newDescription) {
    mockAgent.updateGroupDescription(config.groupId, config.newDescription);
  }

  if (config.imageUrl) {
    mockAgent.updateGroupImage(config.groupId, config.imageUrl);
  }

  if (config.list) {
    mockAgent.listGroups();
  }
}

// Operation: Add member
async function runAddMemberOperation(config: MockConfig): Promise<void> {
  if (!config.groupId) {
    console.error("❌ Error: --group-id is required for add-member operations");
    return;
  }

  const mockAgent = getMockAgent(config.env as any);
  const group = mockAgent.findGroupById(config.groupId);

  if (!group) {
    console.error(`❌ Group not found: ${config.groupId}`);
    return;
  }

  if (config.targetAddress) {
    mockAgent.addMemberToGroup(config.groupId, "new-member", {
      identifier: config.targetAddress,
      identifierKind: IdentifierKind.Ethereum,
    });
  } else if (config.clientInboxId) {
    mockAgent.addMemberToGroup(config.groupId, config.clientInboxId);
  } else {
    console.error(
      "❌ Error: --target or --client-inbox is required for add-member operations",
    );
    return;
  }

  if (config.list) {
    mockAgent.listGroups();
  }
}

// Operation: Add admin
async function runAddAdminOperation(config: MockConfig): Promise<void> {
  if (!config.groupId || !config.clientInboxId) {
    console.error(
      "❌ Error: --group-id and --client-inbox are required for add-admin operations",
    );
    return;
  }

  const mockAgent = getMockAgent(config.env as any);
  mockAgent.addAdmin(config.groupId, config.clientInboxId);

  if (config.list) {
    mockAgent.listGroups();
  }
}

// Operation: List state
async function runListOperation(config: MockConfig): Promise<void> {
  const mockAgent = getMockAgent(config.env as any);

  mockAgent.listClients();
  mockAgent.listGroups();
  mockAgent.listDms();

  const state = mockAgent.getState();
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Clients: ${state.stats.totalClients}`);
  console.log(`   Groups: ${state.stats.totalGroups}`);
  console.log(`   DMs: ${state.stats.totalDms}`);
  console.log(`   Total Messages: ${state.stats.totalMessages}`);
  console.log(`   Environment: ${config.env}`);
}

// Operation: Reset
async function runResetOperation(config: MockConfig): Promise<void> {
  resetMockAgent();
  console.log("🔄 Mock agent state has been reset");
}

async function main(): Promise<void> {
  const config = parseArgs();

  try {
    switch (config.operation) {
      case "client":
        await runClientOperation(config);
        break;
      case "verify":
        await runVerifyOperation(config);
        break;
      case "group":
        await runGroupOperation(config);
        break;
      case "dm":
        await runDmOperation(config);
        break;
      case "message":
        await runMessageOperation(config);
        break;
      case "update":
        await runUpdateOperation(config);
        break;
      case "add-member":
        await runAddMemberOperation(config);
        break;
      case "add-admin":
        await runAddAdminOperation(config);
        break;
      case "list":
        await runListOperation(config);
        break;
      case "reset":
        await runResetOperation(config);
        break;
      default:
        console.error(`❌ Unknown operation: ${config.operation}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error: ${errorMessage}`);
    process.exit(1);
  }

  process.exit(0);
}

void main();
