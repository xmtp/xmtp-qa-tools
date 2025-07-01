/**
 * XMTP IPA Testing Suite
 *
 * This module provides automated testing capabilities for React Native iOS applications (IPA files)
 * using Maestro for UI automation, integrated with the XMTP worker framework.
 *
 * @example
 * ```bash
 * # Set up environment
 * export IPA_PATH=/path/to/your/app.ipa
 * export APP_BUNDLE_ID=com.yourcompany.yourapp
 * export XMTP_ENV=dev
 *
 * # Run setup
 * ./suites/mobile/ipa/setup.sh
 *
 * # Run tests
 * yarn test ipa
 * ```
 */

// Re-export main testing components (commented out due to import issues)
// export { MaestroHelper, createFlow, PerformanceTimer } from './helpers/maestro';
// export { DeviceManager, Device, DeviceConfig } from './helpers/device';

/**
 * Configuration interface for IPA testing
 */
export interface IPATestConfig {
  ipaPath: string;
  bundleId: string;
  device: {
    type: "simulator" | "device";
    udid?: string;
    platform: "iOS";
    platformVersion?: string;
    deviceType?: string;
  };
  maestro: {
    timeout: number;
    screenshotOnFailure: boolean;
    videoRecording: boolean;
    debugMode: boolean;
  };
  xmtp: {
    env: "dev" | "production" | "local";
    workers: string[];
  };
}

/**
 * Default configuration for IPA testing
 */
export const defaultIPAConfig: IPATestConfig = {
  ipaPath: process.env.IPA_PATH || "/path/to/app.ipa",
  bundleId: process.env.APP_BUNDLE_ID || "com.example.app",
  device: {
    type: "simulator",
    platform: "iOS",
    deviceType: process.env.DEVICE_TYPE || "iPhone 15 Pro",
  },
  maestro: {
    timeout: 30000,
    screenshotOnFailure: process.env.SCREENSHOT_ON_FAILURE !== "false",
    videoRecording: process.env.VIDEO_RECORDING === "true",
    debugMode: process.env.MAESTRO_DEBUG === "true",
  },
  xmtp: {
    env: (process.env.XMTP_ENV as any) || "dev",
    workers: ["alice", "bob", "charlie"],
  },
};

/**
 * Available Maestro flows
 */
export const availableFlows = [
  "authentication.yaml",
  "messaging.yaml",
  "groupCreation.yaml",
  "checkMessages.yaml",
  "checkGroupMessages.yaml",
  "backgroundApp.yaml",
  "handleNotification.yaml",
] as const;

export type FlowName = (typeof availableFlows)[number];

/**
 * Utility function to get flow path
 */
export function getFlowPath(flowName: FlowName): string {
  return `suites/mobile/ipa/flows/${flowName}`;
}

/**
 * Validation functions
 */
export const validation = {
  /**
   * Check if required environment variables are set
   */
  checkEnvironment(): { valid: boolean; missing: string[] } {
    const required = ["IPA_PATH", "APP_BUNDLE_ID", "XMTP_ENV"];
    const missing = required.filter((key) => !process.env[key]);

    return {
      valid: missing.length === 0,
      missing,
    };
  },

  /**
   * Check if file exists
   */
  checkFileExists(path: string): boolean {
    try {
      const fs = require("fs");
      return fs.existsSync(path);
    } catch {
      return false;
    }
  },

  /**
   * Validate IPA file
   */
  validateIPA(ipaPath: string): { valid: boolean; error?: string } {
    if (!this.checkFileExists(ipaPath)) {
      return { valid: false, error: `IPA file not found: ${ipaPath}` };
    }

    // Basic validation - check file extension
    if (!ipaPath.toLowerCase().endsWith(".ipa")) {
      return { valid: false, error: "File must have .ipa extension" };
    }

    return { valid: true };
  },
};

/**
 * Logging utility for IPA tests
 */
export const ipaLogger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[IPA] ${message}`, ...args);
  },

  warn: (message: string, ...args: any[]) => {
    console.warn(`[IPA WARNING] ${message}`, ...args);
  },

  error: (message: string, ...args: any[]) => {
    console.error(`[IPA ERROR] ${message}`, ...args);
  },

  debug: (message: string, ...args: any[]) => {
    if (process.env.MAESTRO_DEBUG === "true") {
      console.log(`[IPA DEBUG] ${message}`, ...args);
    }
  },
};

/**
 * Quick start function for IPA testing
 */
export async function quickStart(): Promise<void> {
  const envCheck = validation.checkEnvironment();

  if (!envCheck.valid) {
    ipaLogger.error(
      "Missing required environment variables:",
      envCheck.missing,
    );
    ipaLogger.info("Please set the following variables:");
    envCheck.missing.forEach((key) => {
      ipaLogger.info(`  export ${key}=<your_value>`);
    });
    throw new Error("Environment validation failed");
  }

  const ipaPath = process.env.IPA_PATH!;
  const ipaValidation = validation.validateIPA(ipaPath);

  if (!ipaValidation.valid) {
    ipaLogger.error("IPA validation failed:", ipaValidation.error);
    throw new Error("IPA validation failed");
  }

  ipaLogger.info("Environment validation passed");
  ipaLogger.info(`IPA Path: ${ipaPath}`);
  ipaLogger.info(`Bundle ID: ${process.env.APP_BUNDLE_ID}`);
  ipaLogger.info(`XMTP Environment: ${process.env.XMTP_ENV}`);
}

// Default export
export default {
  config: defaultIPAConfig,
  flows: availableFlows,
  getFlowPath,
  validation,
  logger: ipaLogger,
  quickStart,
};
