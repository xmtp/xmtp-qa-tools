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
  private dbPath!: string;
  nameId!: string;

  constructor(
    persona: Persona,
    env: XmtpEnv,
    dbPath: string,
    options: WorkerOptions = {},
  ) {
    options.workerData = {
      __ts_worker_filename: "../helpers/worker.ts",
      ...(options.workerData as Record<string, unknown>),
    };
    super(new URL(`data:text/javascript,${workerBootstrap}`), options);
    this.dbPath = dbPath;
    this.installationId = persona.installationId;
    this.name = persona.name;
    this.version = persona.version;
    this.env = env;
    this.nameId = `worker:${this.name}-${this.installationId}`;
    return this;
  }

  async initialize(
    testName: string,
  ): Promise<{ address: string; inboxId: string }> {
    try {
      console.time(`[${this.nameId}] initialize`);
      this.postMessage({
        type: "initialize",
        name: this.name,
        env: this.env,
        version: this.version,
        installationId: this.installationId,
        testName: testName,
        dbPath: this.dbPath,
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
    } catch (error: unknown) {
      console.error(`[${this.nameId}] Initialize error  `, error);
      return {
        address: "",
        inboxId: "",
      };
    }
  }

  // New method for sending group messages
  async sendMessage(groupId: string, message: string): Promise<void> {
    // Simulate delay before sending
    try {
      console.log(
        `[${this.nameId}] Sending group message to [${groupId}]: ${message}`,
      );
      console.time(`[${this.nameId}] send`);
      this.postMessage({ type: "sendMessage", groupId, message });
      console.timeEnd(`[${this.nameId}] send`);
      await this.waitForMessage("messageSent");
    } catch (error: unknown) {
      console.error(`[${this.nameId}] Send message error  `, error);
    }
  }
  async createDM(senderAddresses: string): Promise<string> {
    try {
      console.log(`[${this.nameId}] Creating DM with: ${senderAddresses}`);
      console.time(`[${this.nameId}] createDM`);
      this.postMessage({ type: "createDM", senderAddresses });
      const response = await this.waitForMessage<{ dmId: string }>("dmCreated");
      console.log(`[${this.nameId}] DM created: ${response.dmId}`);
      console.timeEnd(`[${this.nameId}] createDM`);
      return response.dmId;
    } catch (error: unknown) {
      console.error(`[${this.nameId}] Create DM error  `, error);
      return "";
    }
  }
  async removeMembers(
    groupId: string,
    memberAddresses: string[],
  ): Promise<number> {
    try {
      console.time(`[${this.nameId}] removeMembers`);
      this.postMessage({ type: "removeMembers", groupId, memberAddresses });
      const response = await this.waitForMessage<{ count: number }>(
        "membersRemoved",
      );
      console.timeEnd(`[${this.nameId}] removeMembers`);
      return response.count;
    } catch (error: unknown) {
      console.error(`[${this.nameId}] Remove members error  `, error);
      return 0;
    }
  }
  async getMembers(groupId: string): Promise<string[]> {
    try {
      console.time(`[${this.nameId}] getMembers`);
      this.postMessage({ type: "getMembers", groupId });
      const response = await this.waitForMessage<{ members: string[] }>(
        "membersReceived",
      );
      console.timeEnd(`[${this.nameId}] getMembers`);
      return response.members;
    } catch (error: unknown) {
      console.error(`[${this.nameId}] Get members error  `, error);
      return [];
    }
  }
  async addMembers(
    groupId: string,
    memberAddresses: string[],
  ): Promise<number> {
    try {
      console.time(`[${this.nameId}] addMembers`);
      this.postMessage({ type: "addMembers", groupId, memberAddresses });
      const response = await this.waitForMessage<{ count: number }>(
        "membersAdded",
      );
      console.timeEnd(`[${this.nameId}] addMembers`);
      return response.count;
    } catch (error: unknown) {
      console.error(`[${this.nameId}] Add members error  `, error);
      return 0;
    }
  }
  async createGroup(senderAddresses: string[]): Promise<string> {
    try {
      console.time(`[${this.nameId}] createGroup`);
      this.postMessage({ type: "createGroup", senderAddresses });
      const response = await this.waitForMessage<{ groupId: string }>(
        "groupCreated",
      );
      console.log(`[${this.nameId}] Group created: ${response.groupId}`);
      console.timeEnd(`[${this.nameId}] createGroup`);
      return response.groupId;
    } catch (error: unknown) {
      console.error(`[${this.nameId}] Group create error  `, error);
      return "";
    }
  }
  async isMember(groupId: string, memberAddress: string): Promise<boolean> {
    try {
      console.time(`[${this.nameId}] isMember`);
      this.postMessage({ type: "isMember", groupId, memberAddress });
      const response = await this.waitForMessage<{ isMember: boolean }>(
        "isMember",
      );
      console.timeEnd(`[${this.nameId}] isMember`);
      return response.isMember;
    } catch (error: unknown) {
      console.error(`[${this.nameId}] Is member error  `, error);
      return false;
    }
  }

  async pullMessages(groupId: string): Promise<string[]> {
    try {
      console.time(`[${this.nameId}] pullMessages`);
      this.postMessage({ type: "pullMessages", groupId });
      const response = await this.waitForMessage<{ messages: string[] }>(
        "messagesPulled",
      );
      console.timeEnd(`[${this.nameId}] pullMessages`);
      return response.messages;
    } catch (error: unknown) {
      console.error(`[${this.nameId}] Pull messages error  `, error);
      return [];
    }
  }

  async receiveMessage(
    groupId: string,
    expectedMessages: string[],
  ): Promise<string[]> {
    try {
      console.time(`[${this.nameId}] receiveMessage`);
      //sdd
      console.log(
        `[${this.nameId}] Started stream for: ${expectedMessages.join(", ")}`,
      );
      this.postMessage({
        type: "receiveMessage",
        groupId,
        expectedMessages,
        name: this.name,
        installationId: this.installationId,
      });
      const response = (await Promise.race([
        this.waitForMessage<{ message: string[] }>("messageReceived"),
      ])) as { message: string[] };
      console.timeEnd(`[${this.nameId}] receiveMessage`);
      return Array.isArray(response.message) ? response.message : [];
    } catch (error: unknown) {
      console.error(`[${this.nameId}] Message receive error  `, error);
      return [];
    }
  }
  async receiveMetadata(groupId: string, expectedMetadata: string) {
    try {
      console.time(`[${this.nameId}] receiveMetadata`);
      this.postMessage({ type: "receiveMetadata", groupId, expectedMetadata });
      const response = await this.waitForMessage<{ metadata: string }>(
        "metadataReceived",
      );
      console.timeEnd(`[${this.nameId}] receiveMetadata`);
      return response.metadata;
    } catch (error: unknown) {
      console.error(`[${this.nameId}] Metadata receive error  `, error);
      return "";
    }
  }
  async updateGroupName(groupId: string, newGroupName: string) {
    try {
      console.time(`[${this.nameId}] updateGroupName`);
      this.postMessage({ type: "updateGroupName", groupId, newGroupName });
      const response = await this.waitForMessage<{ groupName: string }>(
        "groupNameUpdated",
      );
      console.timeEnd(`[${this.nameId}] updateGroupName`);
      return response.groupName;
    } catch (error: unknown) {
      console.error(`[${this.nameId}] Group name update error  `, error);
      return "";
    }
  }
  private async waitForMessage<T = any>(messageType: string): Promise<T> {
    try {
      /* Dont time this */
      const promise = await new Promise<T>((resolve, reject) => {
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
      return promise;
    } catch (error: unknown) {
      console.error(`[${this.nameId}] Wait for message error  `, error);
      return {} as T;
    }
  }
}

if (parentPort) {
  let client: ClientManager;
  parentPort.on("message", (data: WorkerMessage) => {
    void (async () => {
      try {
        switch (data.type) {
          case "initialize": {
            try {
              const logger = createLogger(data.testName as string);
              overrideConsole(logger);

              client = new ClientManager({
                env: data.env as XmtpEnv,
                version: data.version as string,
                name: data.name as string,
                installationId: data.installationId as string,
                dbPath: data.dbPath as string,
              });
              await client.initialize();
              parentPort?.postMessage({
                type: "clientInitialized",
                name: data.name as string,
                address: client.client.accountAddress,
                inboxId: client.client.inboxId,
              });
            } catch (error: unknown) {
              console.error(`[initialize] Initialize error  `, error);
            }
            break;
          }
          case "pullMessages": {
            try {
              const messages = await client.messages(data.groupId as string);
              parentPort?.postMessage({
                type: "messagesPulled",
                messages: messages,
              });
            } catch (error: unknown) {
              console.error(`[pullMessages] Pull messages error  `, error);
            }
            break;
          }
          case "getMembers": {
            try {
              const members = await client.getMembers(data.groupId as string);
              if (!members) {
                throw new Error("Members not received");
              }
              parentPort?.postMessage({
                type: "membersReceived",
                members: members,
              });
            } catch (error: unknown) {
              console.error(`[getMembers] Get members error  `, error);
            }
            break;
          }
          case "isMember": {
            try {
              const isMember = await client.isMember(
                data.groupId as string,
                data.memberAddress as string,
              );
              if (!isMember) {
                throw new Error("Member not found");
              }
              parentPort?.postMessage({
                type: "isMember",
                isMember: isMember,
              });
            } catch (error: unknown) {
              console.error(`[isMember] Is member error  `, error);
            }
            break;
          }
          case "removeMembers": {
            try {
              const count = await client.removeMembers(
                data.groupId as string,
                data.memberAddresses as string[],
              );
              if (!count) {
                throw new Error("Members not removed");
              }
              parentPort?.postMessage({
                type: "membersRemoved",
                count: count,
              });
            } catch (error: unknown) {
              console.error(`[removeMembers] Remove members error  `, error);
            }
            break;
          }
          case "addMembers": {
            try {
              const count = await client.addMembers(
                data.groupId as string,
                data.memberAddresses as string[],
              );
              if (!count) {
                throw new Error("Members not added");
              }
              parentPort?.postMessage({
                type: "membersAdded",
                count: count,
              });
            } catch (error: unknown) {
              console.error(`[addMembers] Add members error  `, error);
            }
            break;
          }
          case "receiveMetadata": {
            try {
              const metadata = await client.receiveMetadata(
                data.groupId as string,
                data.expectedMetadata as string,
              );
              if (!metadata) {
                throw new Error("Metadata not received");
              }
              parentPort?.postMessage({
                type: "metadataReceived",
                metadata: metadata,
              });
            } catch (error: unknown) {
              console.error(
                `[receiveMetadata] Metadata receive error  `,
                error,
              );
            }
            break;
          }
          case "updateGroupName": {
            try {
              const groupName = await client.updateName(
                data.groupId as string,
                data.newGroupName as string,
              );
              if (!groupName) {
                throw new Error("Group name not updated");
              }
              parentPort?.postMessage({
                type: "groupNameUpdated",
                groupName: groupName,
              });
            } catch (error: unknown) {
              console.error(
                `[updateGroupName] Group name update error  `,
                error,
              );
            }
            break;
          }
          case "sendMessage": {
            try {
              await client.send(data.groupId as string, data.message as string);
              parentPort?.postMessage({
                type: "messageSent",
                message: data.message as string,
              });
            } catch (error: unknown) {
              console.error(`[sendMessage] Send message error  `, error);
            }
            break;
          }
          case "receiveMessage": {
            try {
              const message = await client.receiveMessage(
                data.groupId as string,
                data.expectedMessages as string[],
              );
              if (!message) {
                throw new Error("Message not received");
              }
              parentPort?.postMessage({
                type: "messageReceived",
                message: message,
              });
            } catch (error: unknown) {
              console.error(`[receiveMessage] Message receive error  `, error);
            }
            break;
          }
          case "createDM": {
            try {
              console.log(`Creating DM with: ${data.senderAddresses}`);
              const dmId = await client.newDM(data.senderAddresses as string);
              if (!dmId) {
                throw new Error("DM not created");
              }
              parentPort?.postMessage({
                type: "dmCreated",
                dmId: dmId,
              });
            } catch (error: unknown) {
              console.error(`[createDM] Create DM error  `, error);
            }
            break;
          }
          case "createGroup": {
            try {
              const groupId = await client.newGroup(
                data.senderAddresses as string[],
              );
              if (!groupId) {
                throw new Error("Group not created");
              }
              parentPort?.postMessage({
                type: "groupCreated",
                groupId: groupId,
              });
            } catch (error: unknown) {
              console.error(`[createGroup] Create group error  `, error);
            }
            break;
          }
          default: {
            throw new Error(`Unknown message type: ${data.type}`);
          }
        }
      } catch (error: unknown) {
        parentPort?.postMessage({
          type: "error",
          error: (error as Error).message,
        });
      }
    })();
  });
}
