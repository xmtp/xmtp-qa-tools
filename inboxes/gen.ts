import * as crypto from "crypto";
import * as fs from "fs";
import * as readline from "readline";
import {
  createSigner,
  generateEncryptionKeyHex,
  getEncryptionKeyFromHex,
  loadEnv,
} from "@helpers/client";
import { Client, type Signer, type XmtpEnv } from "@xmtp/node-sdk";

// Constants
const CONSTANTS = {
  BASE_LOG_PATH: "./logs",
  DB_FOLDER_NAME: "db",
  INBOXES_DIR: "./inboxes",
  VALID_ENVIRONMENTS: ["local", "dev", "production"] as XmtpEnv[],
  DEFAULT_INSTALLATIONS: 1,
  INBOX_FILE_PATTERN: /^\d+\.json$/,
} as const;

// Type definitions
interface InboxData {
  accountAddress: string;
  walletKey: string;
  dbEncryptionKey: string;
  inboxId: string;
  installations: number;
}

interface LocalInboxData extends InboxData {
  dbPath?: string;
}

interface ExistingInboxData {
  accountAddress: string;
  walletKey: string;
  dbEncryptionKey?: string;
  inboxId: string;
  installations?: number;
}

interface GenerateOptions {
  count?: number;
  envs?: XmtpEnv[];
  installations?: number;
  output?: string;
}

interface UpdateOptions {
  installations?: number;
}

interface ProcessingResult {
  success: number;
  failed: number;
  inboxIds: string[];
}

// CLI Argument Parsing
class CLIParser {
  private args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  getMode(): string | undefined {
    const modeIdx = this.args.findIndex((a) => a === "--mode");
    return modeIdx !== -1 ? this.args[modeIdx + 1] : undefined;
  }

  parseGenerateOptions(): GenerateOptions {
    const options: GenerateOptions = {};
    
    this.args.forEach((arg, i) => {
      switch (arg) {
        case "--count":
          options.count = parseInt(this.args[i + 1], 10);
          break;
        case "--envs":
          options.envs = this.args[i + 1]
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter((env) => CONSTANTS.VALID_ENVIRONMENTS.includes(env as XmtpEnv)) as XmtpEnv[];
          break;
        case "--installations":
          options.installations = parseInt(this.args[i + 1], 10);
          break;
        case "--output":
          options.output = this.args[i + 1];
          break;
      }
    });

    return options;
  }

  parseUpdateOptions(): UpdateOptions {
    const options: UpdateOptions = {};
    
    this.args.forEach((arg, i) => {
      if (arg === "--installations") {
        options.installations = parseInt(this.args[i + 1], 10);
      }
    });

    return options;
  }

  shouldShowHelp(): boolean {
    return this.args.includes("--help") || this.args.includes("-h");
  }
}

// User Input Handler
class UserInputHandler {
  private rl: readline.Interface | null = null;

  private getInterface(): readline.Interface {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
    }
    return this.rl;
  }

  async ask(question: string): Promise<string> {
    const rl = this.getInterface();
    return new Promise<string>((resolve) => {
      rl.question(question, (answer: string) => {
        resolve(answer);
      });
    });
  }

  close(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  async askForAccountCount(): Promise<number> {
    while (true) {
      const answer = await this.ask("How many accounts would you like to generate? ");
      const count = parseInt(answer, 10);
      
      if (!isNaN(count) && count > 0) {
        return count;
      }
      
      console.log("Invalid input. Please enter a positive number.");
    }
  }

  async askForEnvironments(): Promise<XmtpEnv[]> {
    const answer = await this.ask(
      `Enter XMTP environments to use (comma-separated: ${CONSTANTS.VALID_ENVIRONMENTS.join(",")}): `
    );
    
    const envs = answer
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((env) => CONSTANTS.VALID_ENVIRONMENTS.includes(env as XmtpEnv)) as XmtpEnv[];
    
    if (envs.length === 0) {
      console.log("No valid environments provided. Using all environments as default.");
      return [...CONSTANTS.VALID_ENVIRONMENTS];
    }
    
    return envs;
  }
}

// File System Manager
class FileSystemManager {
  static ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      console.log(`Creating directory: ${dirPath}...`);
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  static saveJsonFile(filePath: string, data: any): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  static readJsonFile<T>(filePath: string): T {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  }

  static findInboxFiles(directory: string): string[] {
    return fs
      .readdirSync(directory)
      .filter((file: string) => file.endsWith(".json"))
      .filter((file: string) => CONSTANTS.INBOX_FILE_PATTERN.test(file))
      .map((file: string) => `${directory}/${file}`);
  }

  static generateTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, "-");
  }
}

// XMTP Client Manager
class XMTPClientManager {
  static async createClient(
    signer: Signer,
    dbEncryptionKey: Uint8Array,
    dbPath: string,
    env: XmtpEnv
  ): Promise<Client> {
    return Client.create(signer, {
      dbEncryptionKey,
      dbPath,
      env,
    });
  }

  static async checkAndAdjustInstallations(
    signer: Signer,
    dbEncryptionKey: Uint8Array,
    basePath: string,
    env: XmtpEnv,
    targetInstallations: number,
    accountAddress: string
  ): Promise<{ client: Client; currentInstallations: number }> {
    const dbPath = `${basePath}/${env}-${accountAddress}-install-0`;
    const client = await this.createClient(signer, dbEncryptionKey, dbPath, env);
    
    const state = await client.preferences.inboxState();
    let currentInstallations = state?.installations.length || 0;

    // Revoke surplus installations if needed
    if (currentInstallations > targetInstallations) {
      const surplusCount = currentInstallations - targetInstallations;
      const allInstallations = state?.installations || [];
      
      const installationsToRevoke = allInstallations
        .slice(targetInstallations)
        .map((install: any) => {
          const hexString = install.id.startsWith("0x") ? install.id.slice(2) : install.id;
          return new Uint8Array(Buffer.from(hexString, "hex"));
        });

      if (installationsToRevoke.length > 0) {
        console.log(`  Revoking ${surplusCount} surplus installations...`);
        await client.revokeInstallations(installationsToRevoke);
        currentInstallations = targetInstallations;
      }
    }

    return { client, currentInstallations };
  }
}

// Inbox Generator
class InboxGenerator {
  private inputHandler: UserInputHandler;

  constructor() {
    this.inputHandler = new UserInputHandler();
  }

  async generate(options: GenerateOptions): Promise<void> {
    try {
      const config = await this.prepareConfiguration(options);
      const { logPath, dbPath } = this.setupDirectories(config);
      
      const accountData = await this.generateAccounts(config, logPath, dbPath);
      
      this.saveResults(accountData, config, logPath);
    } finally {
      this.inputHandler.close();
    }
  }

  private async prepareConfiguration(options: GenerateOptions) {
    const count = options.count || await this.inputHandler.askForAccountCount();
    const envs = options.envs || await this.inputHandler.askForEnvironments();
    const installations = options.installations || CONSTANTS.DEFAULT_INSTALLATIONS;

    console.log(`Using environments: ${envs.join(", ")}`);
    console.log(`Creating ${installations} installations per account per network`);

    return { count, envs, installations, output: options.output };
  }

  private setupDirectories(config: { count: number; envs: XmtpEnv[]; installations: number }) {
    const folderName = `db-generated-${config.count}-${config.envs.join(",")}-${config.installations}inst`;
    const logPath = `${CONSTANTS.BASE_LOG_PATH}/${folderName}`;
    const dbPath = `${logPath}/${CONSTANTS.DB_FOLDER_NAME}`;
    
    FileSystemManager.ensureDirectoryExists(dbPath);
    
    return { logPath, dbPath };
  }

  private async generateAccounts(
    config: { count: number; envs: XmtpEnv[]; installations: number },
    logPath: string,
    dbPath: string
  ): Promise<InboxData[]> {
    const accountData: InboxData[] = [];
    let totalCreated = 0;
    let totalFailed = 0;

    for (let i = 0; i < config.count; i++) {
      const accountResult = await this.generateSingleAccount(
        i,
        config,
        logPath,
        dbPath
      );
      
      if (accountResult) {
        accountData.push(accountResult);
        totalCreated += accountResult.installations * config.envs.length;
      } else {
        totalFailed += config.installations * config.envs.length;
      }
    }

    this.printSummary(accountData.length, config.installations, totalCreated, totalFailed);
    
    return accountData;
  }

  private async generateSingleAccount(
    index: number,
    config: { count: number; envs: XmtpEnv[]; installations: number },
    logPath: string,
    dbPath: string
  ): Promise<InboxData | null> {
    const walletKey = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}` as `0x${string}`;
    
    try {
      const signer = createSigner(walletKey);
      const identifier = await signer.getIdentifier();
      const accountAddress = identifier.identifier;
      const dbEncryptionKey = generateEncryptionKeyHex();
      let inboxId = "";

      console.log(`\nProcessing account ${index + 1}/${config.count}: ${accountAddress}`);

      for (const env of config.envs) {
        const envInboxId = await this.createInstallationsForEnvironment(
          signer,
          dbEncryptionKey,
          accountAddress,
          env,
          config.installations,
          dbPath
        );
        
        if (envInboxId && !inboxId) {
          inboxId = envInboxId;
        }
      }

      return {
        accountAddress,
        walletKey,
        dbEncryptionKey,
        inboxId,
        installations: config.installations,
      };
    } catch (error) {
      console.error(`Error processing account ${index + 1}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  private async createInstallationsForEnvironment(
    signer: Signer,
    dbEncryptionKey: string,
    accountAddress: string,
    env: XmtpEnv,
    installationCount: number,
    basePath: string
  ): Promise<string | null> {
    console.log(`Creating ${installationCount} installations on ${env}`);
    let firstInboxId: string | null = null;

    for (let j = 0; j < installationCount; j++) {
      try {
        const installDbPath = `${basePath}/${env}-${accountAddress}-install-${j}`;
        const client = await XMTPClientManager.createClient(
          signer,
          getEncryptionKeyFromHex(dbEncryptionKey),
          installDbPath,
          env
        );

        console.log(`✅ Installation ${j + 1}/${installationCount}: ${client.installationId}`);
        
        if (j === 0) {
          firstInboxId = client.inboxId;
          console.log(`✅ Initialized inbox: ${client.inboxId}`);
        }
      } catch (error) {
        console.error(
          `❌ Failed installation ${j + 1}/${installationCount}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    return firstInboxId;
  }

  private saveResults(accountData: InboxData[], config: any, logPath: string): void {
    const timestamp = FileSystemManager.generateTimestamp();
    const outputFile = config.output || `${logPath}/inboxes-${timestamp}.json`;
    
    FileSystemManager.saveJsonFile(outputFile, accountData);
    
    console.log(`\nData saved to ${outputFile}`);
    console.log(`All data stored in folder: ${logPath}`);
  }

  private printSummary(
    accountsGenerated: number,
    installationsPerAccount: number,
    totalCreated: number,
    totalFailed: number
  ): void {
    console.log(`\n=== Generation Summary ===`);
    console.log(`Successfully generated ${accountsGenerated} accounts`);
    console.log(`Target installations per account per network: ${installationsPerAccount}`);
    console.log(`Total installations created: ${totalCreated}`);
    console.log(`Total installations failed: ${totalFailed}`);
  }
}

// Local Inbox Updater
class LocalInboxUpdater {
  async update(options: UpdateOptions): Promise<void> {
    const env: XmtpEnv = "local";
    loadEnv("update");

    const filesToProcess = this.getFilesToProcess(options);
    
    if (filesToProcess.length === 0) {
      console.error("No inbox JSON files found (looking for files like 25.json, 5.json, etc.)");
      return;
    }

    this.printProcessingInfo(filesToProcess, options);

    for (const inputFile of filesToProcess) {
      await this.processFile(inputFile, env, options);
    }

    console.log("\n=== Overall Local Inbox Update Complete ===");
    console.log(`Processed ${filesToProcess.length} files successfully.`);
  }

  private getFilesToProcess(options: UpdateOptions): string[] {
    if (options.installations) {
      const targetFile = `${CONSTANTS.INBOXES_DIR}/${options.installations}.json`;
      
      if (fs.existsSync(targetFile)) {
        return [targetFile];
      } else {
        console.error(`File ${options.installations}.json not found in ${CONSTANTS.INBOXES_DIR}`);
        return [];
      }
    }

    return FileSystemManager.findInboxFiles(CONSTANTS.INBOXES_DIR);
  }

  private printProcessingInfo(filesToProcess: string[], options: UpdateOptions): void {
    const fileNames = filesToProcess.map((f) => f.replace(`${CONSTANTS.INBOXES_DIR}/`, ""));
    console.log(`Processing ${filesToProcess.length} inbox file(s): ${fileNames.join(", ")}`);
    
    if (options.installations) {
      console.log(`Using installations count: ${options.installations}`);
    }
  }

  private async processFile(
    inputFile: string,
    env: XmtpEnv,
    options: UpdateOptions
  ): Promise<void> {
    console.log(`\n=== Processing ${inputFile} ===`);

    try {
      const generatedInboxes = FileSystemManager.readJsonFile<ExistingInboxData[]>(inputFile);
      
      if (!generatedInboxes || generatedInboxes.length === 0) {
        console.error(`No generated inboxes found in input file: ${inputFile}`);
        return;
      }

      const { logPath } = this.setupFileDirectories(inputFile, generatedInboxes.length, env);
      const results = await this.processInboxes(generatedInboxes, logPath, env, options);
      
      this.printFileSummary(inputFile, generatedInboxes.length, results);
    } catch (error) {
      console.error(`Could not process file ${inputFile}:`, error instanceof Error ? error.message : String(error));
    }
  }

  private setupFileDirectories(inputFile: string, inboxCount: number, env: XmtpEnv) {
    const fileName = inputFile
      .replace(`${CONSTANTS.INBOXES_DIR}/`, "")
      .replace(".json", "");
    const folderName = `db-generated-${fileName}-${inboxCount}-${env}`;
    const logPath = `${CONSTANTS.BASE_LOG_PATH}/${folderName}`;
    
    FileSystemManager.ensureDirectoryExists(logPath);
    
    return { logPath };
  }

  private async processInboxes(
    inboxes: ExistingInboxData[],
    logPath: string,
    env: XmtpEnv,
    options: UpdateOptions
  ): Promise<ProcessingResult> {
    const results: ProcessingResult = { success: 0, failed: 0, inboxIds: [] };
    const accountData: LocalInboxData[] = [];
    const timestamp = FileSystemManager.generateTimestamp();
    const outputFile = `${logPath}/local-inboxes-${timestamp}.json`;

    for (let i = 0; i < inboxes.length; i++) {
      const result = await this.processInbox(inboxes[i], i, inboxes.length, logPath, env, options);
      
      if (result) {
        accountData.push(result);
        FileSystemManager.saveJsonFile(outputFile, accountData);
        results.success++;
        results.inboxIds.push(result.inboxId);
      } else {
        results.failed++;
      }
    }

    console.log(`Data saved to: ${outputFile}`);
    return results;
  }

  private async processInbox(
    inbox: ExistingInboxData,
    index: number,
    total: number,
    logPath: string,
    env: XmtpEnv,
    options: UpdateOptions
  ): Promise<LocalInboxData | null> {
    try {
      this.validateInbox(inbox);

      const installationCount = options.installations || inbox.installations || CONSTANTS.DEFAULT_INSTALLATIONS;
      const signer = createSigner(inbox.walletKey as `0x${string}`);
      const dbEncryptionKey = getEncryptionKeyFromHex(inbox.dbEncryptionKey!);

      console.log(`Initializing inbox ${index + 1}/${total}: ${inbox.accountAddress}`);

      const { client, currentInstallations } = await XMTPClientManager.checkAndAdjustInstallations(
        signer,
        dbEncryptionKey,
        logPath,
        env,
        installationCount,
        inbox.accountAddress
      );

      await this.createAdditionalInstallations(
        signer,
        dbEncryptionKey,
        logPath,
        env,
        inbox.accountAddress,
        currentInstallations,
        installationCount
      );

      this.verifyInboxId(client.inboxId, inbox.inboxId, inbox.accountAddress);

      return {
        accountAddress: inbox.accountAddress,
        inboxId: client.inboxId,
        walletKey: inbox.walletKey,
        dbEncryptionKey: inbox.dbEncryptionKey!,
        dbPath: `${logPath}/${env}-${inbox.accountAddress}-install-0`,
        installations: installationCount,
      };
    } catch (error) {
      console.error(`❌ Error processing inbox ${inbox.accountAddress}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  private validateInbox(inbox: ExistingInboxData): void {
    if (!inbox.walletKey || !inbox.accountAddress || !inbox.inboxId) {
      throw new Error("Missing required fields");
    }

    if (!inbox.dbEncryptionKey) {
      throw new Error("Missing encryption key");
    }
  }

  private async createAdditionalInstallations(
    signer: Signer,
    dbEncryptionKey: Uint8Array,
    logPath: string,
    env: XmtpEnv,
    accountAddress: string,
    currentInstallations: number,
    targetInstallations: number
  ): Promise<void> {
    for (let j = currentInstallations; j < targetInstallations; j++) {
      try {
        const dbPath = `${logPath}/${env}-${accountAddress}-install-${j}`;
        console.log(`  Creating installation ${j + 1}/${targetInstallations}`);
        
        const client = await XMTPClientManager.createClient(signer, dbEncryptionKey, dbPath, env);
        console.log(`  ✅ Created installation: ${client.installationId}`);
      } catch (error) {
        console.error(
          `  ❌ Failed to create installation ${j + 1}/${targetInstallations}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  private verifyInboxId(actualId: string, expectedId: string, accountAddress: string): void {
    if (actualId !== expectedId) {
      console.warn(`Warning: Inbox ID mismatch for ${accountAddress}`);
      console.warn(`  Expected: ${expectedId}`);
      console.warn(`  Actual: ${actualId}`);
    }
  }

  private printFileSummary(fileName: string, totalInboxes: number, results: ProcessingResult): void {
    console.log(`\n=== Summary for ${fileName} ===`);
    console.log(`Total inboxes processed: ${totalInboxes}`);
    console.log(`Successfully initialized: ${results.success}`);
    console.log(`Failed to initialize: ${results.failed}`);
    
    if (results.success > 0) {
      console.log("\nThese inboxes are now ready to use in your local XMTP environment.");
      console.log("You can use them in the stress test by setting XMTP_ENV=local in your .env file.");
    }
  }
}

// Help Display
function showHelp(): void {
  console.log(`
XMTP Generator Utility

Usage:
  yarn gen --mode <mode> [options]

Modes:
  --mode generate-inboxes         Generate new XMTP inboxes with optional installations
  --mode update                   Initialize local inboxes from helpers/inboxes.json (uses defaults)

Options for generate-inboxes:
  --count <number>                Number of accounts to generate
  --envs <envs>                   Comma-separated environments (local,dev,production)
  --installations <number>        Number of installations per account per network (default: 1)
  --output <file>                 Output file (default: logs/db-generated-...)

Options for update:
  --installations <number>        Number of installations to create per account (overrides JSON file value)

  --help                          Show this help message
`);
}

// Main Application
async function main(): Promise<void> {
  const parser = new CLIParser(process.argv.slice(2));

  if (parser.shouldShowHelp()) {
    showHelp();
    return;
  }

  const mode = parser.getMode();
  
  if (!mode) {
    showHelp();
    return;
  }

  try {
    switch (mode) {
      case "generate-inboxes":
        const generateOptions = parser.parseGenerateOptions();
        const generator = new InboxGenerator();
        await generator.generate(generateOptions);
        break;
        
      case "update":
        const updateOptions = parser.parseUpdateOptions();
        const updater = new LocalInboxUpdater();
        await updater.update(updateOptions);
        break;
        
      default:
        showHelp();
    }
  } catch (error) {
    console.error("Fatal error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the application
main().catch(console.error);
