import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const exec = promisify(require("child_process").exec);

export interface MaestroConfig {
  timeout: number;
  screenshotOnFailure: boolean;
  videoRecording: boolean;
  debugMode: boolean;
}

export interface FlowResult {
  success: boolean;
  output: string;
  duration: number;
  screenshots: string[];
  videos: string[];
}

export class MaestroHelper {
  private config: MaestroConfig;
  private appId: string | null = null;
  private device: string | null = null;
  private logsDir: string;
  private screenshotsDir: string;
  private videosDir: string;

  constructor(config: Partial<MaestroConfig> = {}) {
    this.config = {
      timeout: 30000,
      screenshotOnFailure: true,
      videoRecording: false,
      debugMode: process.env.MAESTRO_DEBUG === "true",
      ...config,
    };

    // Setup directories
    this.logsDir = join(process.cwd(), "logs");
    this.screenshotsDir = join(this.logsDir, "screenshots");
    this.videosDir = join(this.logsDir, "videos");

    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    [this.logsDir, this.screenshotsDir, this.videosDir].forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Install app from IPA file
   */
  async installApp(ipaPath: string, deviceId?: string): Promise<void> {
    if (!existsSync(ipaPath)) {
      throw new Error(`IPA file not found: ${ipaPath}`);
    }

    try {
      const deviceArg = deviceId ? `--device ${deviceId}` : "";
      const command = `maestro install ${deviceArg} "${ipaPath}"`;

      if (this.config.debugMode) {
        console.log(`Installing app: ${command}`);
      }

      const { stdout, stderr } = await exec(command);

      if (stderr && !stderr.includes("warning")) {
        throw new Error(`Installation failed: ${stderr}`);
      }

      if (this.config.debugMode) {
        console.log(`Installation successful: ${stdout}`);
      }
    } catch (error) {
      throw new Error(`Failed to install app: ${error.message}`);
    }
  }

  /**
   * Launch app by bundle ID
   */
  async launchApp(bundleId: string, deviceId?: string): Promise<void> {
    this.appId = bundleId;
    this.device = deviceId || null;

    try {
      const deviceArg = deviceId ? `--device ${deviceId}` : "";
      const command = `maestro launch ${deviceArg} ${bundleId}`;

      if (this.config.debugMode) {
        console.log(`Launching app: ${command}`);
      }

      const { stdout, stderr } = await exec(command);

      if (stderr && !stderr.includes("warning")) {
        throw new Error(`Launch failed: ${stderr}`);
      }

      if (this.config.debugMode) {
        console.log(`App launched successfully: ${stdout}`);
      }

      // Wait a moment for app to fully load
      await this.sleep(2000);
    } catch (error) {
      throw new Error(`Failed to launch app: ${error.message}`);
    }
  }

  /**
   * Run a Maestro flow file
   */
  async runFlow(
    flowPath: string,
    variables: Record<string, string> = {},
  ): Promise<FlowResult> {
    const startTime = Date.now();
    const screenshots: string[] = [];
    const videos: string[] = [];

    try {
      // Build command with variables
      let command = `maestro test "${flowPath}"`;

      if (this.device) {
        command += ` --device ${this.device}`;
      }

      // Add environment variables
      for (const [key, value] of Object.entries(variables)) {
        command += ` --env ${key}="${value}"`;
      }

      if (this.config.debugMode) {
        console.log(`Running flow: ${command}`);
      }

      const { stdout, stderr } = await exec(command, {
        timeout: this.config.timeout,
      });

      const duration = Date.now() - startTime;

      if (this.config.debugMode) {
        console.log(`Flow completed in ${duration}ms: ${stdout}`);
      }

      return {
        success: true,
        output: stdout,
        duration,
        screenshots,
        videos,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.config.screenshotOnFailure) {
        const screenshotPath = await this.takeScreenshot(
          `flow-failure-${Date.now()}`,
        );
        screenshots.push(screenshotPath);
      }

      return {
        success: false,
        output: error.message,
        duration,
        screenshots,
        videos,
      };
    }
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(name: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${name}-${timestamp}.png`;
      const screenshotPath = join(this.screenshotsDir, filename);

      const deviceArg = this.device ? `--device ${this.device}` : "";
      const command = `maestro screenshot ${deviceArg} "${screenshotPath}"`;

      if (this.config.debugMode) {
        console.log(`Taking screenshot: ${command}`);
      }

      await exec(command);
      return screenshotPath;
    } catch (error) {
      console.warn(`Failed to take screenshot: ${error.message}`);
      return "";
    }
  }

  /**
   * Start video recording
   */
  async startVideoRecording(name: string): Promise<string> {
    if (!this.config.videoRecording) {
      return "";
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${name}-${timestamp}.mp4`;
      const videoPath = join(this.videosDir, filename);

      const deviceArg = this.device ? `--device ${this.device}` : "";
      const command = `maestro record ${deviceArg} --output "${videoPath}"`;

      if (this.config.debugMode) {
        console.log(`Starting video recording: ${command}`);
      }

      // Start recording in background
      spawn(
        "maestro",
        [
          "record",
          ...(this.device ? ["--device", this.device] : []),
          "--output",
          videoPath,
        ],
        {
          detached: true,
          stdio: "ignore",
        },
      );

      return videoPath;
    } catch (error) {
      console.warn(`Failed to start video recording: ${error.message}`);
      return "";
    }
  }

  /**
   * Stop video recording
   */
  async stopVideoRecording(): Promise<void> {
    try {
      // Send interrupt signal to stop recording
      execSync("pkill -f 'maestro record'", { stdio: "ignore" });
    } catch (error) {
      // Ignore errors when stopping recording
    }
  }

  /**
   * Tap on element
   */
  async tap(selector: string): Promise<void> {
    await this.runMaestroCommand(`tapOn: "${selector}"`);
  }

  /**
   * Input text
   */
  async inputText(text: string): Promise<void> {
    await this.runMaestroCommand(`inputText: "${text}"`);
  }

  /**
   * Assert element is visible
   */
  async assertVisible(selector: string): Promise<void> {
    await this.runMaestroCommand(`assertVisible: "${selector}"`);
  }

  /**
   * Wait for element
   */
  async waitForElement(
    selector: string,
    timeout: number = 5000,
  ): Promise<void> {
    const command = `
- waitForAnimationToEnd:
    timeout: ${timeout}
- assertVisible: "${selector}"
    `;
    await this.runMaestroCommand(command);
  }

  /**
   * Scroll in direction
   */
  async scroll(
    direction: "up" | "down" | "left" | "right",
    distance: number = 300,
  ): Promise<void> {
    await this.runMaestroCommand(`scroll: ${direction}`);
  }

  /**
   * Background app
   */
  async backgroundApp(): Promise<void> {
    await this.runMaestroCommand("pressKey: Home");
  }

  /**
   * Foreground app
   */
  async foregroundApp(): Promise<void> {
    if (this.appId) {
      await this.launchApp(this.appId, this.device);
    }
  }

  /**
   * Terminate app
   */
  async terminateApp(): Promise<void> {
    if (this.appId) {
      try {
        const deviceArg = this.device ? `--device ${this.device}` : "";
        const command = `maestro terminate ${deviceArg} ${this.appId}`;
        await exec(command);
      } catch (error) {
        console.warn(`Failed to terminate app: ${error.message}`);
      }
    }
  }

  /**
   * Run a single Maestro command
   */
  private async runMaestroCommand(command: string): Promise<void> {
    try {
      // Create a temporary flow file for the command
      const tempFlow = `
appId: ${this.appId || ""}
---
${command}
      `.trim();

      const tempFlowPath = join(this.logsDir, `temp-${Date.now()}.yaml`);
      require("fs").writeFileSync(tempFlowPath, tempFlow);

      const result = await this.runFlow(tempFlowPath);

      // Clean up temp file
      require("fs").unlinkSync(tempFlowPath);

      if (!result.success) {
        throw new Error(`Maestro command failed: ${result.output}`);
      }
    } catch (error) {
      throw new Error(`Failed to run Maestro command: ${error.message}`);
    }
  }

  /**
   * Get device information
   */
  async getDeviceInfo(): Promise<any> {
    try {
      const { stdout } = await exec("maestro devices");
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get device info: ${error.message}`);
    }
  }

  /**
   * Check if Maestro is installed and working
   */
  async checkMaestroInstallation(): Promise<boolean> {
    try {
      await exec("maestro --version");
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.stopVideoRecording();
    await this.terminateApp();
  }
}

// Helper function to create Maestro flow content
export function createFlow(appId: string, steps: string[]): string {
  return `appId: ${appId}
---
${steps.map((step) => `- ${step}`).join("\n")}`;
}

// Performance timing utilities
export class PerformanceTimer {
  private startTime: number = 0;
  private measurements: Record<string, number> = {};

  start(): void {
    this.startTime = performance.now();
  }

  measure(label: string): number {
    const duration = performance.now() - this.startTime;
    this.measurements[label] = duration;
    return duration;
  }

  getMeasurements(): Record<string, number> {
    return { ...this.measurements };
  }

  reset(): void {
    this.startTime = 0;
    this.measurements = {};
  }
}
