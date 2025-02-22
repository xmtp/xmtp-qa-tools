/* eslint-disable */
import { parentPort, Worker, type WorkerOptions } from "node:worker_threads";
import { testLogger, TestLogger } from "./logger";
import { ClientManager, type XmtpEnv } from "./manager";
import { Persona } from "./personas";

const defaultVersion = "42";
const defaultInstallationId = "a";

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
  private logger: TestLogger;
  private installationId!: string;
  private env!: XmtpEnv;
  private version!: string;

  constructor(
    persona: Persona,
    env: XmtpEnv,
    logger: TestLogger,
    options: WorkerOptions = {},
  ) {
    options.workerData ??= {};
    options.workerData.__ts_worker_filename = "../helpers/worker.ts".toString();
    super(new URL(`data:text/javascript,${workerBootstrap}`), options);
    this.name = persona.name;
    this.installationId = persona.installationId;
    this.version = persona.version;
    this.env = env;
    this.logger = logger;
    this.setupLogging();
    return this;
  }

  setupLogging() {
    if (this.stdout) {
      this.stdout.on("data", (data) => {
        this.logger?.log(`[${this.name}] ${data.toString().trim()}`);
      });
    }
    if (this.stderr) {
      this.stderr.on("data", (data) => {
        this.logger?.log(`[${this.name}] ${data.toString().trim()}`);
      });
    }
    return this;
  }

  async initialize(): Promise<string> {
    this.postMessage({
      type: "initialize",
      name: this.name,
      env: this.env,
      version: this.version,
      installationId: this.installationId,
    });
    const response = await this.waitForMessage<{ clientAddress: string }>(
      "clientInitialized",
    );

    this.logger?.log(
      `[${this.name}] initialized with: ${JSON.stringify({
        env: this.env,
        version: this.version,
        installationId: this.installationId,
      })}`,
    );
    return response.clientAddress;
  }

  // New method for sending group messages
  async sendMessage(groupId: string, message: string): Promise<void> {
    // Simulate delay before sending
    await new Promise((resolve) => setTimeout(resolve, 2000));
    this.logger?.log(
      `[${this.name}] Sending group message to [${groupId}]: ${message}`,
    );
    this.postMessage({ type: "sendMessage", groupId, message });
    await this.waitForMessage("messageSent");
  }
  async createDM(senderAddresses: string): Promise<string> {
    this.postMessage({ type: "createDM", senderAddresses });
    const response = await this.waitForMessage<{ dmId: string }>("dmCreated");
    this.logger?.log(`[${this.name}] DM created: ${response.dmId}`);
    return response.dmId;
  }

  async createGroup(senderAddresses: string[]): Promise<string> {
    this.postMessage({ type: "createGroup", senderAddresses });
    const response = await this.waitForMessage<{ groupId: string }>(
      "groupCreated",
    );
    this.logger?.log(`[${this.name}] Group created: ${response.groupId}`);
    return response.groupId;
  }

  async receiveMessage(
    senderAddress: string,
    expectedMessage: string,
  ): Promise<string> {
    this.postMessage({
      type: "receiveMessage",
      senderAddress,
      expectedMessage,
    });
    const response = await this.waitForMessage<{ message: string }>(
      "messageReceived",
    );
    this.logger?.log(`[${this.name}] Received message: ${response.message}`);
    return response.message;
  }
  private async waitForMessage<T = any>(messageType: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const handler = (msg: WorkerMessage) => {
        if (msg.type === messageType) {
          this.removeListener("message", handler);
          resolve(msg as T);
        } else if (msg.type === "error") {
          this.removeListener("message", handler);
          this.logger?.log(`[${this.name}] Error: ${msg.error}`);
          reject(new Error(msg.error));
        }
      };
      this.on("message", handler);
    });
  }
}

// Worker implementation (runs in worker thread)
if (parentPort) {
  let client: ClientManager | undefined;
  let workerLogger: TestLogger | undefined;

  parentPort.on("message", async (data: WorkerMessage) => {
    try {
      switch (data.type) {
        case "initialize": {
          client = new ClientManager({
            env: data.env || "dev",
            version: data.version || "42",
            name: data.name,
            installationId: data.installationId || "a",
          });
          await client.initialize();

          parentPort?.postMessage({
            type: "clientInitialized",
            clientAddress: client.client.accountAddress,
            clientName: data.name,
          });
          break;
        }
        case "sendMessage": {
          if (!client) throw new Error("Client not initialized");
          workerLogger?.log(
            `[${client?.name}:Thread] Sending group message to ${data.groupId}`,
          );
          await client.sendMessage(data.groupId, data.message);
          workerLogger?.log(
            `[${client?.name}:Thread] Group message sent successfully`,
          );
          parentPort?.postMessage({
            type: "messageSent",
            message: data.message,
          });
          break;
        }

        case "receiveMessage": {
          if (!client) throw new Error("Client not initialized");
          workerLogger?.log(
            `[${client.name}:Thread] Waiting for message from ${data.name}-${data.installationId}`,
          );
          const message = await client.receiveMessage(data.expectedMessage);
          workerLogger?.log(
            `[${client.name}:Thread] Message received: ${message}`,
          );
          parentPort?.postMessage({
            type: "messageReceived",
            message: message,
          });
          break;
        }
        case "createDM": {
          if (!client) throw new Error("Client not initialized");
          workerLogger?.log("Creating DM");
          const dmId = await client.createDM(data.senderAddresses);
          parentPort?.postMessage({
            type: "dmCreated",
            dmId: dmId,
          });
          break;
        }
        case "createGroup": {
          if (!client) throw new Error("Client not initialized");
          workerLogger?.log("Creating group");
          const groupId = await client.createGroup(data.senderAddresses);
          parentPort?.postMessage({
            type: "groupCreated",
            groupId: groupId,
          });
          break;
        }
      }
    } catch (error: any) {
      if (workerLogger) {
        const workerName = client?.name || data?.name || "Unknown";
        workerLogger?.log(
          `[${workerName}:Thread] Error: ${error.message || String(error)}`,
        );
      }
      parentPort?.postMessage({
        type: "error",
        error: error.message || String(error),
      });
    }
  });
}
