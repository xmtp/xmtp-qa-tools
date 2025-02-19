import fs from "fs";
import path from "path";

export class TestLogger {
  private logDir: string;
  private activeTests: Map<string, { filePath: string; testName: string }>;
  private currentTestName: string | null;

  constructor(private instanceName?: string) {
    this.logDir = path.join(process.cwd(), "test-logs");
    this.ensureLogDirectory();
    this.activeTests = new Map();
    this.currentTestName = null;
  }

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getFilePath(testName: string): string {
    const sanitizedName = testName.replace(/[^a-z0-9]/gi, "_");
    return path.join(this.logDir, `${sanitizedName}.txt`);
  }

  log(message: string) {
    if (!this.currentTestName) {
      throw new Error("No active test found");
    }

    const currentTest = this.activeTests.get(this.currentTestName);
    if (!currentTest) {
      throw new Error(`Test ${this.currentTestName} not found in active tests`);
    }

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(currentTest.filePath, logEntry);
    console.log(`${currentTest.testName}: ${message}`);
  }

  createTest(testName: string) {
    if (!testName) {
      throw new Error("Test name cannot be empty");
    }

    // Create a new logger instance for this test
    const newLogger = new TestLogger(testName);
    const filePath = newLogger.getFilePath(testName);
    fs.writeFileSync(filePath, "");
    newLogger.activeTests.set(testName, { filePath, testName });
    newLogger.currentTestName = testName;
    return newLogger;
  }
}

export const testLogger = new TestLogger();
