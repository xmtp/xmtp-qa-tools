/* eslint-disable */
import { parentPort, Worker, type WorkerOptions } from "node:worker_threads";
import { sleep } from "openai/core.mjs";
import { createLogger, overrideConsole } from "./logger";
import { ClientManager, type XmtpEnv } from "./manager";
import { Persona } from "./personas";

// Types
export type WorkerMessage = {
  type: string;
  [key: string]: any;
};

// Worker bootstrap code
const workerBootstrap = /* JavaScript */ `
  import { createRequire } from "node:module";
  import { workerData } from "node:worker_threads";

  const filename = "${import.meta.url}";
  const require = createRequire(filename);
  const { tsImport } = require("tsx/esm/api");
  
  tsImport(workerData.__ts_worker_filename, filename);
`;

// Main Worker Client class
export class WorkerClient extends Worker {
  public name: string;
  private installationId!: string;
  private env!: XmtpEnv;
  private version!: string;

  constructor(persona: Persona, env: XmtpEnv, options: WorkerOptions = {}) {
    options.workerData ??= {};
    options.workerData.__ts_worker_filename = "../helpers/worker.ts".toString();
    super(new URL(`data:text/javascript,${workerBootstrap}`), options);
    this.name = persona.name;
    this.installationId = persona.installationId;
    this.version = persona.version;
    this.env = env;
    return this;
  }

  async initialize(
    testName: string,
  ): Promise<{ address: string; inboxId: string }> {
    this.postMessage({
      type: "initialize",
      name: this.name,
      env: this.env,
      version: this.version,
      installationId: this.installationId,
      testName: testName,
    });
    const response = await this.waitForMessage<{
      address: string;
      inboxId: string;
    }>("clientInitialized");
    console.log(
      `[${this.name}] initialized with: ${this.env}:${this.version}:${this.installationId}`,
    );
    return {
      address: response.address,
      inboxId: response.inboxId,
    };
  }

  // New method for sending group messages
  async sendMessage(groupId: string, message: string): Promise<void> {
    // Simulate delay before sending
    console.log(
      `[${this.name}] Sending group message to [${groupId}]: ${message}`,
    );
    console.time(`[${this.name}] send`);
    this.postMessage({ type: "sendMessage", groupId, message });
    console.timeEnd(`[${this.name}] send`);
    const returnValue = await this.waitForMessage("messageSent");
    return returnValue;
  }
  async createDM(senderAddresses: string): Promise<string> {
    this.postMessage({ type: "createDM", senderAddresses });
    const response = await this.waitForMessage<{ dmId: string }>("dmCreated");
    return response.dmId;
  }
  async removeMembers(
    groupId: string,
    memberAddresses: string[],
  ): Promise<number> {
    console.time(`[${this.name}] removeMembers`);
    this.postMessage({ type: "removeMembers", groupId, memberAddresses });
    const response = await this.waitForMessage<{ count: number }>(
      "membersRemoved",
    );
    console.timeEnd(`[${this.name}] removeMembers`);
    return response.count;
  }
  async getMembers(groupId: string): Promise<string[]> {
    console.time(`[${this.name}] getMembers`);
    this.postMessage({ type: "getMembers", groupId });
    const response = await this.waitForMessage<{ members: string[] }>(
      "membersReceived",
    );
    console.timeEnd(`[${this.name}] getMembers`);
    return response.members;
  }
  async addMembers(
    groupId: string,
    memberAddresses: string[],
  ): Promise<number> {
    console.time(`[${this.name}] addMembers`);
    this.postMessage({ type: "addMembers", groupId, memberAddresses });
    const response = await this.waitForMessage<{ count: number }>(
      "membersAdded",
    );
    console.timeEnd(`[${this.name}] addMembers`);
    return response.count;
  }
  async createGroup(senderAddresses: string[]): Promise<string> {
    console.time(`[${this.name}] createGroup`);
    this.postMessage({ type: "createGroup", senderAddresses });
    const response = await this.waitForMessage<{ groupId: string }>(
      "groupCreated",
    );
    console.log(`[${this.name}] Group created: ${response.groupId}`);
    console.timeEnd(`[${this.name}] createGroup`);
    return response.groupId;
  }

  async receiveMessage(
    groupId: string,
    expectedMessage: string,
  ): Promise<string | null> {
    this.postMessage({
      type: "receiveMessage",
      groupId,
      expectedMessage,
      name: this.name,
      installationId: this.installationId,
    });
    console.time(`[${this.name}] receiveMessage`);
    try {
      const response = await Promise.race([
        this.waitForMessage<{ message: string }>("messageReceived"),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Message receive timeout after 3 seconds")),
            3000,
          ),
        ),
      ]);
      console.log(`[${this.name}] Received message: ${expectedMessage}`);
      console.timeEnd(`[${this.name}] receiveMessage`);
      return (response as any).message;
    } catch (error) {
      console.log(`[${this.name}] Message receive timeout`);
      console.timeEnd(`[${this.name}] receiveMessage`);
      return null;
    }
  }
  async receiveMetadata(groupId: string, expectedMetadata: string) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.time(`[${this.name}] receiveMetadata`);
    this.postMessage({ type: "receiveMetadata", groupId, expectedMetadata });
    const response = await this.waitForMessage<{ metadata: string }>(
      "metadataReceived",
    );
    console.timeEnd(`[${this.name}] receiveMetadata`);
    return response.metadata;
  }
  async updateGroupName(groupId: string, newGroupName: string) {
    console.time(`[${this.name}] updateGroupName`);
    this.postMessage({ type: "updateGroupName", groupId, newGroupName });
    const response = await this.waitForMessage<{ groupName: string }>(
      "groupNameUpdated",
    );
    console.timeEnd(`[${this.name}] updateGroupName`);
    return response.groupName;
  }
  private async waitForMessage<T = any>(messageType: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const handler = (msg: WorkerMessage) => {
        if (msg.type === messageType) {
          this.removeListener("message", handler);
          resolve(msg as T);
        } else if (msg.type === "error") {
          this.removeListener("message", handler);
          console.log(`[${this.name}] Error: ${msg.error}`);
          reject(new Error(msg.error));
        }
      };
      this.on("message", handler);
    });
  }
}

// Worker implementation (runs in worker thread)
if (parentPort) {
  let client: ClientManager;

  parentPort.on("message", async (data: WorkerMessage) => {
    try {
      switch (data.type) {
        case "initialize": {
          // Use the same logger instance with the test name
          console.time(`[${data.name}] initialize`);
          const logger = createLogger(data.testName);
          overrideConsole(logger);

          client = new ClientManager({
            env: data.env || "dev",
            version: data.version || "42",
            name: data.name,
            installationId: data.installationId || "a",
          });
          await client.initialize();
          console.timeEnd(`[${data.name}] initialize`);
          parentPort?.postMessage({
            type: "clientInitialized",
            name: data.name,
            address: client.client.accountAddress,
            inboxId: client.client.inboxId,
          });
          break;
        }
        case "getMembers": {
          if (!client) throw new Error("Client not initialized");
          console.time(`[${client?.name}] getMembers`);
          const members = await client.getMembers(data.groupId);
          console.timeEnd(`[${client?.name}] getMembers`);
          parentPort?.postMessage({
            type: "membersReceived",
            members: members,
          });
          break;
        }
        case "removeMembers": {
          if (!client) throw new Error("Client not initialized");
          console.time(`[${client?.name}] removeMembers`);
          const count = await client.removeMembers(
            data.groupId,
            data.memberAddresses,
          );
          console.timeEnd(`[${client?.name}] removeMembers`);
          parentPort?.postMessage({
            type: "membersRemoved",
            count: count,
          });
          break;
        }
        case "addMembers": {
          if (!client) throw new Error("Client not initialized");
          console.time(`[${client?.name}] addMembers`);
          const count = await client.addMembers(
            data.groupId,
            data.memberAddresses,
          );
          console.timeEnd(`[${client?.name}] addMembers`);
          parentPort?.postMessage({
            type: "membersAdded",
            count: count,
          });
          break;
        }
        case "metadataReceived": {
          if (!client) throw new Error("Client not initialized");
          console.time(`[${client?.name}] metadataReceived`);
          const metadata = await client.receiveMetadata(
            data.groupId,
            data.expectedMetadata,
          );
          console.timeEnd(`[${client?.name}] metadataReceived`);
          parentPort?.postMessage({
            type: "metadataReceived",
            metadata: metadata,
          });
          break;
        }
        case "updateGroupName": {
          if (!client) throw new Error("Client not initialized");
          console.time(`[${client?.name}] updateGroupName`);
          const groupName = await client.updateName(
            data.groupId,
            data.newGroupName,
          );
          console.log(`[${client?.name}] Group name updated: ${groupName}`);
          console.timeEnd(`[${client?.name}] updateGroupName`);
          parentPort?.postMessage({
            type: "groupNameUpdated",
            groupName: groupName,
          });
        }
        case "sendMessage": {
          if (!client) throw new Error("Client not initialized");
          console.log(
            `[${client?.name}] Sending group message to ${data.groupId}`,
          );
          console.time(`[${client?.name}] sendMessage`);
          await client.send(data.groupId, data.message);
          console.timeEnd(`[${client?.name}] sendMessage`);
          console.log(
            `[${client?.name}] Group message ${data.message} successfully`,
          );
          parentPort?.postMessage({
            type: "messageSent",
            message: data.message,
          });
          break;
        }
        case "receiveMetadata": {
          if (!client) throw new Error("Client not initialized");
          console.time(`[${client?.name}] receiveMetadata`);
          console.log(
            `[${client.name}] Waiting for metadata from group ${data.groupId}`,
          );
          const metadata = await client.receiveMetadata(
            data.groupId,
            data.expectedMetadata,
          );
          console.log(`[${client?.name}] Metadata received: ${metadata}`);
          console.timeEnd(`[${client?.name}] receiveMetadata`);
          parentPort?.postMessage({
            type: "metadataReceived",
            metadata: metadata,
          });
          break;
        }
        case "receiveMessage": {
          if (!client) throw new Error("Client not initialized");
          console.time(`[${client?.name}] receiveMessage`);
          console.log(
            `[${client.name}] Started stream for group ${data.groupId}`,
          );
          const message = await client.receiveMessage(
            data.groupId,
            data.expectedMessage,
          );
          console.timeEnd(`[${client?.name}] receiveMessage`);
          console.log(`[${client.name}] Message received: ${message}`);
          parentPort?.postMessage({
            type: "messageReceived",
            message: message,
          });
          break;
        }
        case "createDM": {
          if (!client) throw new Error("Client not initialized");
          console.time(`[${client?.name}] createDM`);
          const dmId = await client.newDM(data.senderAddresses);
          console.timeEnd(`[${client?.name}] createDM`);
          parentPort?.postMessage({
            type: "dmCreated",
            dmId: dmId,
          });
          break;
        }
        case "createGroup": {
          if (!client) throw new Error("Client not initialized");
          console.time(`[${client?.name}] createGroup`);

          const groupId = await client.newGroup(data.senderAddresses);
          console.timeEnd(`[${client?.name}] createGroup`);
          parentPort?.postMessage({
            type: "groupCreated",
            groupId: groupId,
          });
          break;
        }
        default: {
          console.log(`[${client?.name}] Unknown message type: ${data.type}`);
          break;
        }
      }
    } catch (error: any) {
      console.time(`[${client?.name}] error`);
      const workerName = client?.name || data?.name || "Unknown";
      console.log(`[${workerName}] Error: ${error.message || String(error)}`);
      console.timeEnd(`[${client?.name}] error`);
      parentPort?.postMessage({
        type: "error",
        error: error.message,
      });
    }
  });
}
