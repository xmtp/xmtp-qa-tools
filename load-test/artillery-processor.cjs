"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// artillery-processor.ts
var artillery_processor_exports = {};
__export(artillery_processor_exports, {
  afterScenario: () => afterScenario,
  beforeScenario: () => beforeScenario,
  default: () => artillery_processor_default,
  sendMessage: () => sendMessage
});
module.exports = __toCommonJS(artillery_processor_exports);
var import_node_sdk = require("@xmtp/node-sdk");
var import_fs = require("fs");

// xmtp-helpers.ts
var import_viem = require("viem");
var import_accounts = require("viem/accounts");
var import_chains = require("viem/chains");
var import_utils = require("viem/utils");
var import_uint8arrays = require("uint8arrays");
var IdentifierKind = {
  Ethereum: 0,
  Passkey: 1
};
var createUser = (key) => {
  const privateKey = key || (0, import_accounts.generatePrivateKey)();
  const account = (0, import_accounts.privateKeyToAccount)(privateKey);
  return {
    key: privateKey,
    account,
    wallet: (0, import_viem.createWalletClient)({
      account,
      chain: import_chains.sepolia,
      transport: (0, import_viem.http)()
    })
  };
};
var createSigner = (key) => {
  let user;
  if (typeof key === "string") {
    const sanitizedKey = key.startsWith("0x") ? key : `0x${key}`;
    user = createUser(sanitizedKey);
  } else {
    user = key;
  }
  return {
    type: "EOA",
    getAddress: () => user.account.address.toLowerCase(),
    getIdentifier: () => ({
      identifierKind: IdentifierKind.Ethereum,
      identifier: user.account.address.toLowerCase()
    }),
    signMessage: async (message) => {
      const signature = await user.wallet.signMessage({
        message,
        account: user.account
      });
      return (0, import_utils.toBytes)(signature);
    }
  };
};
var encryptionKeyFromHex = (hex) => {
  return (0, import_uint8arrays.fromString)(hex, "hex");
};

// workload-config.ts
var WORKLOAD_PRESETS = {
  // 100% messages - original behavior
  messagesOnly: {
    sendMessage: 100,
    updateName: 0,
    updateDescription: 0,
    updateImageUrl: 0,
    addMember: 0,
    removeMember: 0,
    addAdmin: 0,
    removeAdmin: 0,
    addSuperAdmin: 0,
    removeSuperAdmin: 0,
    sync: 0
  },
  // Balanced mix across all operation types
  balanced: {
    sendMessage: 40,
    updateName: 10,
    updateDescription: 5,
    updateImageUrl: 5,
    addMember: 10,
    removeMember: 10,
    addAdmin: 5,
    removeAdmin: 5,
    addSuperAdmin: 5,
    removeSuperAdmin: 5,
    sync: 0
  },
  // Heavy metadata changes
  metadata: {
    sendMessage: 30,
    updateName: 20,
    updateDescription: 20,
    updateImageUrl: 20,
    addMember: 5,
    removeMember: 5,
    addAdmin: 0,
    removeAdmin: 0,
    addSuperAdmin: 0,
    removeSuperAdmin: 0,
    sync: 0
  },
  // Heavy member churn
  memberChurn: {
    sendMessage: 20,
    updateName: 5,
    updateDescription: 0,
    updateImageUrl: 0,
    addMember: 35,
    removeMember: 35,
    addAdmin: 2.5,
    removeAdmin: 2.5,
    addSuperAdmin: 0,
    removeSuperAdmin: 0,
    sync: 0
  },
  // Admin operations focus
  adminOps: {
    sendMessage: 30,
    updateName: 5,
    updateDescription: 5,
    updateImageUrl: 0,
    addMember: 10,
    removeMember: 10,
    addAdmin: 15,
    removeAdmin: 10,
    addSuperAdmin: 10,
    removeSuperAdmin: 5,
    sync: 0
  },
  // Realistic production-like mix
  realistic: {
    sendMessage: 70,
    updateName: 5,
    updateDescription: 2,
    updateImageUrl: 1,
    addMember: 8,
    removeMember: 5,
    addAdmin: 3,
    removeAdmin: 2,
    addSuperAdmin: 2,
    removeSuperAdmin: 2,
    sync: 0
  }
};
function validateWorkloadMix(mix) {
  const total = Object.values(mix).reduce((sum, val) => sum + val, 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`Workload mix must total 100%, got ${total}%`);
  }
}
function selectOperation(mix) {
  validateWorkloadMix(mix);
  const random = Math.random() * 100;
  let cumulative = 0;
  for (const [operation, weight] of Object.entries(mix)) {
    cumulative += weight;
    if (random <= cumulative) {
      return operation;
    }
  }
  return "sendMessage";
}
function getWorkloadMix(presetOrCustom) {
  if (typeof presetOrCustom === "string") {
    const preset = WORKLOAD_PRESETS[presetOrCustom];
    if (!preset) {
      throw new Error(`Unknown workload preset: ${presetOrCustom}. Available: ${Object.keys(WORKLOAD_PRESETS).join(", ")}`);
    }
    return preset;
  }
  return presetOrCustom;
}

// artillery-processor.ts
var config = null;
var clients = /* @__PURE__ */ new Map();
var workloadMix = null;
var operationStats = {
  sendMessage: 0,
  updateName: 0,
  updateDescription: 0,
  updateImageUrl: 0,
  addMember: 0,
  removeMember: 0,
  addAdmin: 0,
  removeAdmin: 0,
  addSuperAdmin: 0,
  removeSuperAdmin: 0,
  sync: 0,
  errors: {}
};
var lastLogTime = Date.now();
var operationsThisSecond = 0;
function loadConfig() {
  if (config) return config;
  const configPath = process.env.CONFIG_PATH || "./data/load-test-config.json";
  const configData = (0, import_fs.readFileSync)(configPath, "utf-8");
  config = JSON.parse(configData);
  const preset = config.config.workloadPreset || "messagesOnly";
  workloadMix = getWorkloadMix(preset);
  console.log(`[Worker ${process.pid}] Loaded config: ${config.identities.length} identities, ${config.groups.length} groups, ${config.poolIdentities?.length || 0} pool identities`);
  console.log(`[Worker ${process.pid}] Workload preset: ${preset}`);
  return config;
}
async function getClient(identity) {
  const cached = clients.get(identity.inboxId);
  if (cached) return cached;
  try {
    const signer = createSigner(identity.privateKey);
    const clientOptions = {
      env: config.config.env,
      dbEncryptionKey: encryptionKeyFromHex(identity.encryptionKey),
      dbPath: `./data/dbs/${identity.inboxId.slice(0, 8)}.db3`
    };
    if (config.config.d14nHost) {
      clientOptions.d14nHost = config.config.d14nHost;
    } else if (config.config.apiUrl) {
      clientOptions.apiUrl = config.config.apiUrl;
    }
    const client = await import_node_sdk.Client.create(signer, clientOptions);
    await client.conversations.sync();
    clients.set(identity.inboxId, client);
    console.log(`[Worker ${process.pid}] Created client for ${identity.accountAddress}`);
    return client;
  } catch (error) {
    console.error(`[Worker ${process.pid}] Failed to create client:`, error);
    throw error;
  }
}
function selectSenderForGroup(group) {
  const cfg = loadConfig();
  const memberIdentities = cfg.identities.filter(
    (id) => group.memberInboxIds.includes(id.inboxId)
  );
  if (memberIdentities.length === 0) {
    throw new Error(`No identities found for group ${group.id}`);
  }
  return memberIdentities[Math.floor(Math.random() * memberIdentities.length)];
}
function selectRandomGroup() {
  const cfg = loadConfig();
  return cfg.groups[Math.floor(Math.random() * cfg.groups.length)];
}
function selectRandomPoolIdentity() {
  const cfg = loadConfig();
  if (!cfg.poolIdentities || cfg.poolIdentities.length === 0) {
    throw new Error("No pool identities available for add/remove operations");
  }
  return cfg.poolIdentities[Math.floor(Math.random() * cfg.poolIdentities.length)];
}
async function getGroup(client, groupId) {
  const conversation = await client.conversations.getConversationById(groupId);
  if (!conversation) {
    throw new Error(`Conversation not found: ${groupId}`);
  }
  return conversation;
}
async function opSendMessage(group, sender, events) {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  const messageText = `Load test message ${operationStats.sendMessage} from ${sender.accountAddress.slice(0, 8)} at ${(/* @__PURE__ */ new Date()).toISOString()}`;
  const startTime = Date.now();
  await conversation.send(messageText);
  const duration = Date.now() - startTime;
  operationStats.sendMessage++;
  events.emit("counter", "operations.sendMessage", 1);
  events.emit("histogram", "operation.sendMessage.duration", duration);
}
async function opUpdateName(group, sender, events) {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  const newName = `Load Test Group - ${Date.now()}`;
  const startTime = Date.now();
  await conversation.updateName(newName);
  const duration = Date.now() - startTime;
  operationStats.updateName++;
  events.emit("counter", "operations.updateName", 1);
  events.emit("histogram", "operation.updateName.duration", duration);
}
async function opUpdateDescription(group, sender, events) {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  const newDescription = `Load test description updated at ${(/* @__PURE__ */ new Date()).toISOString()}`;
  const startTime = Date.now();
  await conversation.updateDescription(newDescription);
  const duration = Date.now() - startTime;
  operationStats.updateDescription++;
  events.emit("counter", "operations.updateDescription", 1);
  events.emit("histogram", "operation.updateDescription.duration", duration);
}
async function opUpdateImageUrl(group, sender, events) {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  const newImageUrl = `https://example.com/image-${Date.now()}.jpg`;
  const startTime = Date.now();
  await conversation.updateImageUrl(newImageUrl);
  const duration = Date.now() - startTime;
  operationStats.updateImageUrl++;
  events.emit("counter", "operations.updateImageUrl", 1);
  events.emit("histogram", "operation.updateImageUrl.duration", duration);
}
async function opAddMember(group, sender, events) {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  const poolIdentity = selectRandomPoolIdentity();
  const startTime = Date.now();
  await conversation.addMembers([poolIdentity.inboxId]);
  const duration = Date.now() - startTime;
  operationStats.addMember++;
  events.emit("counter", "operations.addMember", 1);
  events.emit("histogram", "operation.addMember.duration", duration);
}
async function opRemoveMember(group, sender, events) {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  const members = await conversation.members();
  if (members.length <= 2) {
    await opAddMember(group, sender, events);
    return;
  }
  const removableMembers = members.filter((m) => m.inboxId !== sender.inboxId);
  if (removableMembers.length === 0) {
    throw new Error("No removable members");
  }
  const targetMember = removableMembers[Math.floor(Math.random() * removableMembers.length)];
  const startTime = Date.now();
  await conversation.removeMembers([targetMember.inboxId]);
  const duration = Date.now() - startTime;
  operationStats.removeMember++;
  events.emit("counter", "operations.removeMember", 1);
  events.emit("histogram", "operation.removeMember.duration", duration);
}
async function opAddAdmin(group, sender, events) {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  const members = await conversation.members();
  const nonAdminMembers = members.filter((m) => !conversation.isAdmin(m.inboxId) && m.inboxId !== sender.inboxId);
  if (nonAdminMembers.length === 0) {
    return;
  }
  const targetMember = nonAdminMembers[Math.floor(Math.random() * nonAdminMembers.length)];
  const startTime = Date.now();
  await conversation.addAdmin(targetMember.inboxId);
  const duration = Date.now() - startTime;
  operationStats.addAdmin++;
  events.emit("counter", "operations.addAdmin", 1);
  events.emit("histogram", "operation.addAdmin.duration", duration);
}
async function opRemoveAdmin(group, sender, events) {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  const admins = conversation.admins.filter((adminId) => !conversation.isSuperAdmin(adminId));
  if (admins.length === 0) {
    return;
  }
  const targetAdmin = admins[Math.floor(Math.random() * admins.length)];
  const startTime = Date.now();
  await conversation.removeAdmin(targetAdmin);
  const duration = Date.now() - startTime;
  operationStats.removeAdmin++;
  events.emit("counter", "operations.removeAdmin", 1);
  events.emit("histogram", "operation.removeAdmin.duration", duration);
}
async function opAddSuperAdmin(group, sender, events) {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  const members = await conversation.members();
  const nonSuperAdminMembers = members.filter((m) => !conversation.isSuperAdmin(m.inboxId) && m.inboxId !== sender.inboxId);
  if (nonSuperAdminMembers.length === 0) {
    return;
  }
  const targetMember = nonSuperAdminMembers[Math.floor(Math.random() * nonSuperAdminMembers.length)];
  const startTime = Date.now();
  await conversation.addSuperAdmin(targetMember.inboxId);
  const duration = Date.now() - startTime;
  operationStats.addSuperAdmin++;
  events.emit("counter", "operations.addSuperAdmin", 1);
  events.emit("histogram", "operation.addSuperAdmin.duration", duration);
}
async function opRemoveSuperAdmin(group, sender, events) {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  const superAdmins = conversation.superAdmins.filter((adminId) => adminId !== sender.inboxId);
  if (superAdmins.length === 0) {
    return;
  }
  const targetSuperAdmin = superAdmins[Math.floor(Math.random() * superAdmins.length)];
  const startTime = Date.now();
  await conversation.removeSuperAdmin(targetSuperAdmin);
  const duration = Date.now() - startTime;
  operationStats.removeSuperAdmin++;
  events.emit("counter", "operations.removeSuperAdmin", 1);
  events.emit("histogram", "operation.removeSuperAdmin.duration", duration);
}
async function opSync(group, sender, events) {
  const client = await getClient(sender);
  const conversation = await getGroup(client, group.id);
  const startTime = Date.now();
  await conversation.sync();
  const duration = Date.now() - startTime;
  operationStats.sync++;
  events.emit("counter", "operations.sync", 1);
  events.emit("histogram", "operation.sync.duration", duration);
}
function logMetrics() {
  const now = Date.now();
  const elapsed = (now - lastLogTime) / 1e3;
  if (elapsed >= 10) {
    const rate = operationsThisSecond / elapsed;
    const totalOps = Object.values(operationStats).reduce(
      (sum, val) => typeof val === "number" ? sum + val : sum,
      0
    );
    console.log(`[Worker ${process.pid}] Rate: ${rate.toFixed(2)} ops/s | Total: ${totalOps} operations`);
    console.log(`[Worker ${process.pid}] Stats: ${JSON.stringify(operationStats)}`);
    lastLogTime = now;
    operationsThisSecond = 0;
  }
}
async function sendMessage(userContext, events, done) {
  try {
    if (!config || !workloadMix) {
      loadConfig();
    }
    const operation = selectOperation(workloadMix);
    const group = selectRandomGroup();
    const sender = selectSenderForGroup(group);
    switch (operation) {
      case "sendMessage":
        await opSendMessage(group, sender, events);
        break;
      case "updateName":
        await opUpdateName(group, sender, events);
        break;
      case "updateDescription":
        await opUpdateDescription(group, sender, events);
        break;
      case "updateImageUrl":
        await opUpdateImageUrl(group, sender, events);
        break;
      case "addMember":
        await opAddMember(group, sender, events);
        break;
      case "removeMember":
        await opRemoveMember(group, sender, events);
        break;
      case "addAdmin":
        await opAddAdmin(group, sender, events);
        break;
      case "removeAdmin":
        await opRemoveAdmin(group, sender, events);
        break;
      case "addSuperAdmin":
        await opAddSuperAdmin(group, sender, events);
        break;
      case "removeSuperAdmin":
        await opRemoveSuperAdmin(group, sender, events);
        break;
      case "sync":
        await opSync(group, sender, events);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    operationsThisSecond++;
    events.emit("counter", "operations.total", 1);
    logMetrics();
    if (done) done();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Worker ${process.pid}] Error executing operation:`, errorMsg);
    if (!operationStats.errors[errorMsg]) {
      operationStats.errors[errorMsg] = 0;
    }
    operationStats.errors[errorMsg]++;
    events.emit("counter", "operations.failed", 1);
    if (done) done(error);
    else throw error;
  }
}
async function beforeScenario(userContext, events, done) {
  console.log(`[Worker ${process.pid}] Initializing...`);
  try {
    loadConfig();
    if (done) done();
  } catch (error) {
    console.error(`[Worker ${process.pid}] Failed to initialize:`, error);
    if (done) done(error);
    else throw error;
  }
}
async function afterScenario(userContext, events, done) {
  const totalOps = Object.values(operationStats).reduce(
    (sum, val) => typeof val === "number" ? sum + val : sum,
    0
  );
  console.log(`[Worker ${process.pid}] Shutting down... Executed ${totalOps} operations`);
  console.log(`[Worker ${process.pid}] Final stats:`, JSON.stringify(operationStats, null, 2));
  try {
    const statsFile = `./data/worker-${process.pid}-stats.json`;
    (0, import_fs.writeFileSync)(statsFile, JSON.stringify(operationStats, null, 2));
    console.log(`[Worker ${process.pid}] Saved stats to ${statsFile}`);
  } catch (error) {
    console.error(`[Worker ${process.pid}] Failed to save stats:`, error);
  }
  for (const [inboxId, client] of clients.entries()) {
    try {
      console.log(`[Worker ${process.pid}] Cleaned up client ${inboxId.slice(0, 8)}`);
    } catch (error) {
      console.error(`[Worker ${process.pid}] Error cleaning up client:`, error);
    }
  }
  clients.clear();
  if (done) done();
}
var artillery_processor_default = {
  sendMessage,
  beforeScenario,
  afterScenario
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  afterScenario,
  beforeScenario,
  sendMessage
});
