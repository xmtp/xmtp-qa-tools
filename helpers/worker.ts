import { parentPort, Worker, type WorkerOptions } from "node:worker_threads";
import { createLogger, overrideConsole } from "./logger";
import { ClientManager, type XmtpEnv } from "./manager";
import type { Persona } from "./personas";

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
  private nameId!: string;

  constructor(persona: Persona, env: XmtpEnv, options: WorkerOptions = {}) {
    options.workerData = {
      __ts_worker_filename: "../helpers/worker.ts",
      ...(options.workerData as Record<string, unknown>),
    };
    super(new URL(`data:text/javascript,${workerBootstrap}`), options);

    this.installationId = persona.installationId;
    this.name = persona.name;
    this.version = persona.version;
    this.env = env;
    this.nameId = `${this.name}-${this.installationId}`;
    return this;
  }

  async initialize(
    testName: string,
  ): Promise<{ address: string; inboxId: string }> {
    console.time(`[${this.nameId}] initialize`);
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
    console.timeEnd(`[${this.nameId}] initialize`);
    console.log(
      `[${this.nameId}] initialized with: ${this.env}:${this.version}:${this.installationId}`,
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
      `[${this.nameId}] Sending group message to [${groupId}]: ${message}`,
    );
    console.time(`[${this.nameId}] send`);
    this.postMessage({ type: "sendMessage", groupId, message });
    console.timeEnd(`[${this.nameId}] send`);
    await this.waitForMessage("messageSent");
  }
  async createDM(senderAddresses: string): Promise<string> {
    console.time(`[${this.nameId}] createDM`);
    this.postMessage({ type: "createDM", senderAddresses });
    const response = await this.waitForMessage<{ dmId: string }>("dmCreated");
    console.timeEnd(`[${this.nameId}] createDM`);
    return response.dmId;
  }
  async removeMembers(
    groupId: string,
    memberAddresses: string[],
  ): Promise<number> {
    console.time(`[${this.nameId}] removeMembers`);
    this.postMessage({ type: "removeMembers", groupId, memberAddresses });
    const response = await this.waitForMessage<{ count: number }>(
      "membersRemoved",
    );
    console.timeEnd(`[${this.nameId}] removeMembers`);
    return response.count;
  }
  async getMembers(groupId: string): Promise<string[]> {
    console.time(`[${this.nameId}] getMembers`);
    this.postMessage({ type: "getMembers", groupId });
    const response = await this.waitForMessage<{ members: string[] }>(
      "membersReceived",
    );
    console.timeEnd(`[${this.nameId}] getMembers`);
    return response.members;
  }
  async addMembers(
    groupId: string,
    memberAddresses: string[],
  ): Promise<number> {
    console.time(`[${this.nameId}] addMembers`);
    this.postMessage({ type: "addMembers", groupId, memberAddresses });
    const response = await this.waitForMessage<{ count: number }>(
      "membersAdded",
    );
    console.timeEnd(`[${this.nameId}] addMembers`);
    return response.count;
  }
  async createGroup(senderAddresses: string[]): Promise<string> {
    console.time(`[${this.nameId}] createGroup`);
    this.postMessage({ type: "createGroup", senderAddresses });
    const response = await this.waitForMessage<{ groupId: string }>(
      "groupCreated",
    );
    console.log(`[${this.nameId}] Group created: ${response.groupId}`);
    console.timeEnd(`[${this.nameId}] createGroup`);
    return response.groupId;
  }
  async isMember(groupId: string, memberAddress: string): Promise<boolean> {
    console.time(`[${this.nameId}] isMember`);
    this.postMessage({ type: "isMember", groupId, memberAddress });
    const response = await this.waitForMessage<{ isMember: boolean }>(
      "isMember",
    );
    console.timeEnd(`[${this.nameId}] isMember`);
    return response.isMember;
  }

  async pullMessages(groupId: string): Promise<string[]> {
    console.time(`[${this.nameId}] pullMessages`);
    this.postMessage({ type: "pullMessages", groupId });
    const response = await this.waitForMessage<{ messages: string[] }>(
      "messagesPulled",
    );
    console.timeEnd(`[${this.nameId}] pullMessages`);
    return response.messages;
  }

  async receiveMessage(
    groupId: string,
    expectedMessage: string[],
  ): Promise<string[]> {
    this.postMessage({
      type: "receiveMessage",
      groupId,
      expectedMessage,
      name: this.name,
      installationId: this.installationId,
    });
    console.time(`[${this.nameId}] receiveMessage`);
    try {
      const response = (await Promise.race([
        this.waitForMessage<{ message: string[] }>("messageReceived"),
      ])) as { message: string[] };
      console.log(`[${this.nameId}] Received messages:`, response);
      console.timeEnd(`[${this.nameId}] receiveMessage`);
      return response.message;
    } catch (error: unknown) {
      console.log(
        `[${this.nameId}] Message receive timeout after 4 seconds`,
        error,
      );
      return [];
    }
  }
  async receiveMetadata(groupId: string, expectedMetadata: string) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.time(`[${this.nameId}] receiveMetadata`);
    this.postMessage({ type: "receiveMetadata", groupId, expectedMetadata });
    const response = await this.waitForMessage<{ metadata: string }>(
      "metadataReceived",
    );
    console.timeEnd(`[${this.nameId}] receiveMetadata`);
    return response.metadata;
  }
  async updateGroupName(groupId: string, newGroupName: string) {
    console.time(`[${this.nameId}] updateGroupName`);
    this.postMessage({ type: "updateGroupName", groupId, newGroupName });
    const response = await this.waitForMessage<{ groupName: string }>(
      "groupNameUpdated",
    );
    console.timeEnd(`[${this.nameId}] updateGroupName`);
    return response.groupName;
  }
  private async waitForMessage<T = any>(messageType: string): Promise<T> {
    console.time(`[${this.nameId}] waitForMessage`);
    const promise = new Promise((resolve, reject) => {
      const handler = (msg: WorkerMessage) => {
        if (msg.type === messageType) {
          this.removeListener("message", handler);
          resolve(msg as T);
        } else if (msg.type === "error") {
          this.removeListener("message", handler);
          console.log(`[${this.nameId}] Error: ${msg.error}`);
          reject(new Error(msg.error as string));
        }
      };
      this.on("message", handler);
    });
    console.timeEnd(`[${this.nameId}] waitForMessage`);
    return promise as Promise<T>;
  }
}

if (parentPort) {
  let client: ClientManager;
  /* eslint-disable */
  parentPort.on("message", async (data: WorkerMessage) => {
    try {
      switch (data.type) {
        case "initialize": {
          const logger = createLogger(data.testName);
          overrideConsole(logger);

          client = new ClientManager({
            env: data.env || "dev",
            version: data.version || "42",
            name: data.name,
            installationId: data.installationId || "a",
          });
          await client.initialize();
          parentPort?.postMessage({
            type: "clientInitialized",
            name: data.name,
            address: client.client.accountAddress,
            inboxId: client.client.inboxId,
          });
          break;
        }
        case "pullMessages": {
          if (!client) throw new Error("Client not initialized");
          const messages = await client.messages(data.groupId);
          parentPort?.postMessage({
            type: "messagesPulled",
            messages: messages,
          });
          break;
        }
        case "getMembers": {
          if (!client) throw new Error("Client not initialized");
          const members = await client.getMembers(data.groupId);
          parentPort?.postMessage({
            type: "membersReceived",
            members: members,
          });
          break;
        }
        case "isMember": {
          if (!client) throw new Error("Client not initialized");
          const isMember = await client.isMember(
            data.groupId,
            data.memberAddress,
          );
        }
        case "removeMembers": {
          if (!client) throw new Error("Client not initialized");
          const count = await client.removeMembers(
            data.groupId,
            data.memberAddresses,
          );
          parentPort?.postMessage({
            type: "membersRemoved",
            count: count,
          });
          break;
        }
        case "addMembers": {
          if (!client) throw new Error("Client not initialized");
          const count = await client.addMembers(
            data.groupId,
            data.memberAddresses,
          );
          parentPort?.postMessage({
            type: "membersAdded",
            count: count,
          });
          break;
        }
        case "metadataReceived": {
          if (!client) throw new Error("Client not initialized");
          const metadata = await client.receiveMetadata(
            data.groupId,
            data.expectedMetadata,
          );
          parentPort?.postMessage({
            type: "metadataReceived",
            metadata: metadata,
          });
          break;
        }
        case "updateGroupName": {
          if (!client) throw new Error("Client not initialized");
          const groupName = await client.updateName(
            data.groupId,
            data.newGroupName,
          );
          parentPort?.postMessage({
            type: "groupNameUpdated",
            groupName: groupName,
          });
        }
        case "sendMessage": {
          if (!client) throw new Error("Client not initialized");

          await client.send(data.groupId, data.message);
          parentPort?.postMessage({
            type: "messageSent",
            message: data.message,
          });
          break;
        }
        case "receiveMetadata": {
          if (!client) throw new Error("Client not initialized");

          const metadata = await client.receiveMetadata(
            data.groupId,
            data.expectedMetadata,
          );
          parentPort?.postMessage({
            type: "metadataReceived",
            metadata: metadata,
          });
          break;
        }
        case "receiveMessage": {
          const message = await client.receiveMessage(
            data.groupId,
            data.expectedMessage,
          );
          parentPort?.postMessage({
            type: "messageReceived",
            message: message,
          });
          break;
        }
        case "createDM": {
          if (!client) throw new Error("Client not initialized");
          const dmId = await client.newDM(data.senderAddresses);
          parentPort?.postMessage({
            type: "dmCreated",
            dmId: dmId,
          });
          break;
        }
        case "createGroup": {
          if (!client) throw new Error("Client not initialized");

          const groupId = await client.newGroup(data.senderAddresses);
          parentPort?.postMessage({
            type: "groupCreated",
            groupId: groupId,
          });
          break;
        }
        default: {
          throw new Error(`Unknown message type: ${data.type}`);
        }
      }
    } catch (error: any) {
      parentPort?.postMessage({
        type: "error",
        error: error.message,
      });
    }
  });
}
