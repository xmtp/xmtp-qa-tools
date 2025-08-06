import fs from "node:fs";
import { Worker, type WorkerOptions } from "node:worker_threads";
import {
  createClient,
  getDataPath,
  getEncryptionKeyFromHex,
  streamTimeout,
} from "@helpers/client";
import {
  ConsentState,
  regressionClient,
  type Client,
  type DecodedMessage,
  type XmtpEnv,
} from "version-management/client-versions";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";
import path from "node:path";
import type { WorkerBase } from "./manager";

export const installationThreshold = 5;

// Simplified enums
export enum StreamType {
  Message = "message",
  MessageAndResponse = "message_and_response",
  GroupUpdated = "group_updated",
  Conversation = "conversation",
  Consent = "consent",
  None = "none",
}

export enum SyncType {
  SyncAll = "sync_all",
  Sync = "sync_conversation",
  Both = "both",
  None = "none",
}

// Simplified message types
interface StreamMessage {
  type: string;
  data: any;
}

// Simplified worker client
export class WorkerClient extends Worker {
  public name: string;
  public sdk: string;
  private walletKey: string;
  private encryptionKeyHex: string;
  private folder: string;
  public address!: `0x${string}`;
  public client!: Client;
  private env: XmtpEnv;
  private apiUrl?: string;
  private activeStreams: Set<StreamType> = new Set();
  private streamControllers: Map<StreamType, AbortController> = new Map();
  public dbPath!: string;

  constructor(
    worker: WorkerBase,
    env: XmtpEnv,
    options: WorkerOptions = {},
    apiUrl?: string,
    customDbPath?: string,
  ) {
    const workerCode = `
      import { parentPort } from "node:worker_threads";
      if (parentPort) {
        parentPort.on("message", (message) => {
          console.debug("[Worker] Received:", message.type);
        });
      }
    `;

    super(new URL(`data:text/javascript,${workerCode}`), {
      ...options,
      workerData: { worker },
    });

    this.name = worker.name;
    this.sdk = worker.sdk;
    this.folder = worker.folder;
    this.env = env;
    this.apiUrl = apiUrl;
    this.walletKey = worker.walletKey;
    this.encryptionKeyHex = worker.encryptionKey;
    this.dbPath = customDbPath || "";

    this.setupEventHandlers();
  }

  private getWorkerCode(): string {
    return `
      import { parentPort } from "node:worker_threads";
      if (parentPort) {
        parentPort.on("message", (message) => {
          console.debug("[Worker] Received:", message.type);
        });
      }
    `;
  }

  private setupEventHandlers() {
    this.on("error", (error) => {
      console.error(`[${this.name}] Worker error:`, error);
    });
    this.on("exit", (code) => {
      if (code !== 0) {
        console.error(`[${this.name}] Worker stopped with exit code ${code}`);
      }
    });
  }

  async initialize(): Promise<{
    client: Client;
    dbPath: string;
    installationId: string;
    address: `0x${string}`;
  }> {
    let client: unknown;
    let dbPath: string;

    if (this.dbPath) {
      client = await regressionClient(
        this.sdk,
        this.walletKey as `0x${string}`,
        getEncryptionKeyFromHex(this.encryptionKeyHex),
        this.dbPath,
        this.env,
        this.apiUrl,
      );
      dbPath = this.dbPath;
    } else {
      const result = await createClient(
        this.walletKey as `0x${string}`,
        this.encryptionKeyHex,
        this.sdk,
        this.name,
        this.folder,
        this.env,
        this.apiUrl,
      );
      client = result.client;
      dbPath = result.dbPath;
    }

    this.dbPath = dbPath;
    this.client = client as Client;
    this.address =
      (client as any).address ||
      privateKeyToAccount(this.walletKey as `0x${string}`).address;

    return {
      client: this.client,
      dbPath,
      address: this.address,
      installationId: this.client.installationId,
    };
  }

  // Simplified stream management
  startStream(streamType: StreamType): void {
    if (streamType === StreamType.None || this.activeStreams.has(streamType)) {
      return;
    }

    this.activeStreams.add(streamType);
    const controller = new AbortController();
    this.streamControllers.set(streamType, controller);

    void this.runStream(streamType, controller);
  }

  private async runStream(streamType: StreamType, controller: AbortController) {
    try {
      switch (streamType) {
        case StreamType.Message:
        case StreamType.MessageAndResponse:
          await this.runMessageStream(streamType, controller);
          break;
        case StreamType.GroupUpdated:
          await this.runGroupUpdateStream(controller);
          break;
        case StreamType.Conversation:
          await this.runConversationStream(controller);
          break;
        case StreamType.Consent:
          await this.runConsentStream(controller);
          break;
      }
    } catch (error) {
      console.error(`[${this.name}] Stream error:`, error);
    }
  }

  private async runMessageStream(
    streamType: StreamType,
    controller: AbortController,
  ) {
    while (this.activeStreams.has(streamType) && !controller.signal.aborted) {
      try {
        const stream = await this.client.conversations.streamAllMessages();
        for await (const message of stream) {
          if (!this.activeStreams.has(streamType) || controller.signal.aborted)
            break;

          if (
            !message ||
            message.senderInboxId.toLowerCase() ===
              this.client.inboxId.toLowerCase()
          ) {
            continue;
          }

          if (streamType === StreamType.MessageAndResponse) {
            await this.handleResponse(message);
          }

          this.emit("worker_message", {
            type: "message",
            data: {
              conversationId: message.conversationId,
              senderInboxId: message.senderInboxId,
              content: message.content as string,
              contentType: message.contentType,
            },
          });
        }
      } catch (error) {
        console.error(`[${this.name}] Message stream error:`, error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async runGroupUpdateStream(controller: AbortController) {
    while (
      this.activeStreams.has(StreamType.GroupUpdated) &&
      !controller.signal.aborted
    ) {
      try {
        const stream = await this.client.conversations.streamAllMessages();
        for await (const message of stream) {
          if (
            !this.activeStreams.has(StreamType.GroupUpdated) ||
            controller.signal.aborted
          )
            break;

          if (message?.contentType?.typeId === "group_updated") {
            const content = message.content as any;
            this.emit("worker_message", {
              type: "group_updated",
              data: {
                conversationId: message.conversationId,
                name:
                  content.metadataFieldChanges?.find(
                    (c: any) => c.fieldName === "group_name",
                  )?.newValue || "Unknown",
                addedInboxes: content.addedInboxes,
              },
            });
          }
        }
      } catch (error) {
        console.error(`[${this.name}] Group update stream error:`, error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async runConversationStream(controller: AbortController) {
    while (
      this.activeStreams.has(StreamType.Conversation) &&
      !controller.signal.aborted
    ) {
      try {
        const stream = this.client.conversations.stream();
        for await (const conversation of await stream) {
          if (
            !this.activeStreams.has(StreamType.Conversation) ||
            controller.signal.aborted
          )
            break;

          if (conversation?.id) {
            this.emit("worker_message", {
              type: "conversation",
              data: { id: conversation.id },
            });
          }
        }
      } catch (error) {
        console.error(`[${this.name}] Conversation stream error:`, error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async runConsentStream(controller: AbortController) {
    while (
      this.activeStreams.has(StreamType.Consent) &&
      !controller.signal.aborted
    ) {
      try {
        const stream = await this.client.preferences.streamConsent();
        for await (const consentUpdate of stream) {
          if (
            !this.activeStreams.has(StreamType.Consent) ||
            controller.signal.aborted
          )
            break;

          if (Array.isArray(consentUpdate) && consentUpdate.length > 0) {
            for (const consent of consentUpdate) {
              this.emit("worker_message", {
                type: "consent",
                data: {
                  inboxId:
                    typeof consent.entity === "string" ? consent.entity : "",
                  consentValue: consent.state === ConsentState.Allowed,
                },
              });
            }
          }
        }
      } catch (error) {
        console.error(`[${this.name}] Consent stream error:`, error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async handleResponse(message: DecodedMessage) {
    try {
      if (message.senderInboxId === this.client.inboxId) return;

      const conversation = await this.client.conversations.getConversationById(
        message.conversationId,
      );
      if (!conversation) return;

      const baseName = this.name.split("-")[0].toLowerCase();
      const isDm = (await conversation.metadata())?.conversationType === "dm";
      const content = (message.content as string).toLowerCase();

      const shouldRespond =
        isDm ||
        (["text", "reaction", "reply"].includes(
          message?.contentType?.typeId || "",
        ) &&
          content.includes(baseName) &&
          !content.includes("/") &&
          !content.includes("workers") &&
          !content.includes("members") &&
          !content.includes("admins"));

      if (shouldRespond) {
        let response = `${this.name}-${this.sdk} says: gm from sdk ${this.sdk}`;
        if (conversation.debugInfo !== undefined) {
          const debugInfo = await conversation.debugInfo();
          response += ` and epoch ${debugInfo?.epoch}`;
        }
        await conversation.send(response);
      }
    } catch (error) {
      console.error(`[${this.name}] Response error:`, error);
    }
  }

  stopStreams(): void {
    this.activeStreams.clear();
    for (const controller of this.streamControllers.values()) {
      controller.abort();
    }
    this.streamControllers.clear();
  }

  endStream(streamType?: StreamType): void {
    if (streamType) {
      this.activeStreams.delete(streamType);
      const controller = this.streamControllers.get(streamType);
      if (controller) {
        controller.abort();
        this.streamControllers.delete(streamType);
      }
    } else {
      this.stopStreams();
    }
  }

  startSync(syncType: SyncType, interval: number = 10000): void {
    if (syncType === SyncType.None) return;

    void (async () => {
      while (true) {
        try {
          if (syncType === SyncType.SyncAll) {
            await this.client.conversations.syncAll();
          } else if (syncType === SyncType.Sync) {
            await this.client.conversations.sync();
          } else if (syncType === SyncType.Both) {
            await this.client.conversations.syncAll();
            await this.client.conversations.sync();
          }
          await new Promise((resolve) => setTimeout(resolve, interval));
        } catch (error) {
          console.error(`[${this.name}] Sync error:`, error);
          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      }
    })();
  }

  // Simplified collection methods
  collectStreamEvents<T extends StreamMessage>(options: {
    type: StreamType;
    filterFn?: (msg: StreamMessage) => boolean;
    count: number;
    customTimeout?: number;
  }): Promise<T[]> {
    const { type, filterFn, count, customTimeout = streamTimeout } = options;

    return new Promise((resolve) => {
      const events: T[] = [];
      let resolved = false;

      const onMessage = (msg: StreamMessage) => {
        const isRightType = msg.type === type;
        const passesFilter = !filterFn || filterFn(msg);

        if (isRightType && passesFilter) {
          events.push(msg as T);
          if (events.length >= count) {
            resolved = true;
            this.off("worker_message", onMessage);
            clearTimeout(timeoutId);
            resolve(events);
          }
        }
      };

      this.on("worker_message", onMessage);

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.off("worker_message", onMessage);
          console.error(
            `[${this.name}] Collector timed out. Expected ${count} events, collected ${events.length}`,
          );
          resolve(events);
        }
      }, customTimeout);
    });
  }

  collectMessages(
    groupId: string,
    count: number,
    types: string[] = ["text"],
  ): Promise<StreamMessage[]> {
    return this.collectStreamEvents({
      type: StreamType.Message,
      filterFn: (msg) => {
        if (msg.type !== "message") return false;
        const data = msg.data;
        return (
          data.conversationId === groupId &&
          types.includes(data.contentType?.typeId)
        );
      },
      count,
    });
  }

  collectGroupUpdates(
    groupId: string,
    count: number,
  ): Promise<StreamMessage[]> {
    return this.collectStreamEvents({
      type: StreamType.GroupUpdated,
      filterFn: (msg) => {
        if (msg.type !== "group_updated") return false;
        return msg.data.conversationId === groupId;
      },
      count,
    });
  }

  collectConversations(
    fromInboxId: string,
    count: number = 1,
  ): Promise<StreamMessage[]> {
    return this.collectStreamEvents({
      type: StreamType.Conversation,
      filterFn: (msg) =>
        msg.type === "conversation" && msg.data.id !== undefined,
      count,
    });
  }

  collectConsentUpdates(count: number = 1): Promise<StreamMessage[]> {
    return this.collectStreamEvents({
      type: StreamType.Consent,
      count,
    });
  }

  // Database management
  async clearDB(): Promise<boolean> {
    const dataPath = getDataPath() + "/" + this.name + "/" + this.folder;
    try {
      if (fs.existsSync(dataPath)) {
        fs.rmSync(dataPath, { recursive: true, force: true });
      }
      return true;
    } catch (error) {
      console.error(`[${this.name}] Error clearing database:`, error);
      return false;
    }
  }

  async getSQLiteFileSizes(): Promise<{
    dbFile: number;
    walFile: number;
    shmFile: number;
    total: number;
    conversations: number;
  }> {
    const dbDir = path.dirname(this.dbPath);
    const dbFileName = path.basename(this.dbPath);
    const files = fs.readdirSync(dbDir);

    const sizes = {
      dbFile: 0,
      walFile: 0,
      shmFile: 0,
      total: 0,
      conversations: 0,
    };

    for (const file of files) {
      if (!file.startsWith(dbFileName)) continue;

      const filePath = path.join(dbDir, file);
      const stats = fs.statSync(filePath);

      if (file === dbFileName) {
        sizes.dbFile = Math.round(stats.size / (1024 * 1024));
      } else if (file.endsWith("-wal")) {
        sizes.walFile = Math.round(stats.size / (1024 * 1024));
      } else if (file.endsWith("-shm")) {
        sizes.shmFile = Math.round(stats.size / (1024 * 1024));
      }
    }

    sizes.total = sizes.dbFile + sizes.walFile + sizes.shmFile;
    const conversations = await this.client.conversations.list();
    sizes.conversations = conversations.length;

    return sizes;
  }

  async getStats(): Promise<void> {
    const stats = await this.client.debugInformation?.apiStatistics();
    console.debug(
      JSON.stringify(
        {
          "Query Group Messages": stats?.queryGroupMessages.toString(),
          "Query Welcome Messages": stats?.queryWelcomeMessages.toString(),
          "Send Group Messages": stats?.sendGroupMessages.toString(),
          "Send Welcome Messages": stats?.sendWelcomeMessages.toString(),
          "Upload Key Package": stats?.uploadKeyPackage.toString(),
          "Fetch Key Package": stats?.fetchKeyPackage.toString(),
          "Subscribe Messages": stats?.subscribeMessages.toString(),
          "Subscribe Welcomes": stats?.subscribeWelcomes.toString(),
        },
        null,
        2,
      ),
    );
    this.client.debugInformation.clearAllStatistics();
  }

  // Installation management
  async checkAndManageInstallations(targetCount: number): Promise<number> {
    const installations = await this.client.preferences.inboxState();
    const currentCount = installations.installations.length;

    if (currentCount === targetCount) {
      return currentCount;
    } else if (currentCount > targetCount) {
      await this.addNewInstallation();
      return currentCount + 1;
    } else {
      for (let i = 0; i < targetCount - currentCount; i++) {
        await this.addNewInstallation();
      }
      return targetCount;
    }
  }

  async checkInstallationAge(): Promise<void> {
    const installations = await this.client.preferences.inboxState();
    for (const installation of installations.installations) {
      const timestampMs = Number(installation.clientTimestampNs) / 1_000_000;
      const installationDate = new Date(timestampMs);
      const diffDays = Math.floor(
        (Date.now() - installationDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays > 90) {
        console.warn(
          `[${this.name}] Installation: ${diffDays} days ago ${diffDays < 90 ? "✅" : "❌"}`,
        );
      }
    }
  }

  async revokeExcessInstallations(
    threshold: number = installationThreshold,
  ): Promise<void> {
    const installations = await this.client.preferences.inboxState();
    if (installations.installations.length > threshold) {
      await this.client.revokeAllOtherInstallations();
    }
  }

  private getNextAlphabeticalFolder(): string {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    const baseName = this.name.split("-")[0];
    const dataPath = getDataPath() + "/" + baseName;
    const existingFolders = new Set<string>();

    if (fs.existsSync(dataPath)) {
      const folders = fs.readdirSync(dataPath);
      folders.forEach((folder) => {
        if (/^[a-z](\d+)?$/.test(folder)) {
          existingFolders.add(folder);
        }
      });
    }

    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      if (!existingFolders.has(letter)) {
        return letter;
      }
    }

    let numIndex = 1;
    while (true) {
      const newId = `a${numIndex}`;
      if (!existingFolders.has(newId)) {
        return newId;
      }
      numIndex++;
    }
  }

  async addNewInstallation(): Promise<{
    client: Client;
    dbPath: string;
    installationId: string;
    address: `0x${string}`;
  }> {
    this.stopStreams();
    const newFolder = this.getNextAlphabeticalFolder();

    const { client, dbPath, address } = await createClient(
      this.walletKey as `0x${string}`,
      this.encryptionKeyHex,
      this.sdk,
      this.name,
      newFolder,
      this.env,
    );

    this.dbPath = dbPath;
    this.client = client as Client;
    this.address = address;
    this.folder = newFolder;

    return {
      client: this.client,
      dbPath,
      address,
      installationId: this.client.installationId,
    };
  }

  async reinstall(): Promise<void> {
    this.stopStreams();
    await super.terminate();
    await this.clearDB();
    await this.initialize();
  }

  terminate() {
    this.stopStreams();
    return super.terminate();
  }

  get currentFolder(): string {
    return this.folder;
  }
}
