import { exec as execCallback } from "child_process";
import { promisify } from "util";

const exec = promisify(execCallback);

export interface Device {
  udid: string;
  name: string;
  state: string;
  isAvailable: boolean;
  deviceTypeIdentifier: string;
  runtimeIdentifier: string;
  platform: "iOS" | "Android";
}

export interface DeviceConfig {
  type: "simulator" | "device";
  udid?: string;
  platform: "iOS";
  platformVersion?: string;
  deviceType?: string;
}

export class DeviceManager {
  private currentDevice: Device | null = null;

  /**
   * Get all available iOS simulators
   */
  async getSimulators(): Promise<Device[]> {
    try {
      const { stdout } = await exec("xcrun simctl list devices --json");
      const data = JSON.parse(stdout);
      const devices: Device[] = [];

      for (const runtimeName in data.devices) {
        if (runtimeName.includes("iOS")) {
          const runtimeDevices = data.devices[runtimeName] || [];
          for (const device of runtimeDevices) {
            devices.push({
              udid: device.udid,
              name: device.name,
              state: device.state,
              isAvailable: device.isAvailable,
              deviceTypeIdentifier: device.deviceTypeIdentifier,
              runtimeIdentifier: runtimeName,
              platform: "iOS",
            });
          }
        }
      }

      return devices;
    } catch (error) {
      throw new Error(`Failed to get simulators: ${(error as Error).message}`);
    }
  }

  /**
   * Get all connected physical devices
   */
  async getPhysicalDevices(): Promise<Device[]> {
    try {
      const { stdout } = await exec("xcrun devicectl list devices --json");
      const data = JSON.parse(stdout);
      const devices: Device[] = [];

      if (data.result && data.result.devices) {
        for (const device of data.result.devices) {
          devices.push({
            udid: device.identifier,
            name: device.name,
            state: device.connectionProperties?.tunnelState || "unknown",
            isAvailable: true,
            deviceTypeIdentifier:
              device.hardwareProperties?.deviceType || "unknown",
            runtimeIdentifier:
              device.deviceProperties?.osVersionNumber || "unknown",
            platform: "iOS",
          });
        }
      }

      return devices;
    } catch (error) {
      // Fallback to legacy method if devicectl fails
      try {
        const { stdout: legacyOutput } = await exec("instruments -s devices");
        const devices: Device[] = [];
        const lines = legacyOutput.split("\n");

        for (const line of lines) {
          const match = line.match(
            /^(.+?)\s+\[([A-F0-9-]+)\](?:\s+\((.*?)\))?/,
          );
          if (match && !line.includes("Simulator")) {
            const [, name, udid, version] = match;
            devices.push({
              udid: udid.trim(),
              name: name.trim(),
              state: "connected",
              isAvailable: true,
              deviceTypeIdentifier: "physical-device",
              runtimeIdentifier: version || "unknown",
              platform: "iOS",
            });
          }
        }

        return devices;
      } catch (legacyError) {
        console.warn(
          "Both devicectl and legacy methods failed, returning empty device list",
        );
        return [];
      }
    }
  }

  /**
   * Start a simulator
   */
  async startSimulator(udid?: string, deviceType?: string): Promise<Device> {
    try {
      let targetUdid = udid;

      if (!targetUdid) {
        // Find an available simulator or create one
        const simulators = await this.getSimulators();

        // Prefer iPhone 15 Pro if available
        let targetSim = simulators.find(
          (sim) => sim.name.includes("iPhone 15 Pro") && sim.isAvailable,
        );

        if (!targetSim) {
          // Fallback to any available iPhone
          targetSim = simulators.find(
            (sim) => sim.name.includes("iPhone") && sim.isAvailable,
          );
        }

        if (!targetSim) {
          // Create a new simulator
          targetUdid = await this.createSimulator(
            deviceType || "iPhone 15 Pro",
            "iOS-17-0",
          );
        } else {
          targetUdid = targetSim.udid;
        }
      }

      // Boot the simulator
      await exec(`xcrun simctl boot ${targetUdid}`);

      // Wait for simulator to be ready
      await this.waitForSimulator(targetUdid);

      // Get device info
      const simulators = await this.getSimulators();
      const device = simulators.find((sim) => sim.udid === targetUdid);

      if (!device) {
        throw new Error(
          `Could not find started simulator with UDID: ${targetUdid}`,
        );
      }

      this.currentDevice = device;
      return device;
    } catch (error) {
      throw new Error(`Failed to start simulator: ${(error as Error).message}`);
    }
  }

  /**
   * Create a new simulator
   */
  async createSimulator(deviceType: string, runtime: string): Promise<string> {
    try {
      const name = `TestDevice-${Date.now()}`;
      const deviceTypeId = `com.apple.CoreSimulator.SimDeviceType.${deviceType.replace(/\s+/g, "-")}`;
      const runtimeId = `com.apple.CoreSimulator.SimRuntime.${runtime}`;

      const { stdout } = await exec(
        `xcrun simctl create "${name}" "${deviceTypeId}" "${runtimeId}"`,
      );

      const udid = stdout.trim();
      console.log(`Created new simulator: ${name} (${udid})`);
      return udid;
    } catch (error) {
      throw new Error(
        `Failed to create simulator: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Stop a simulator
   */
  async stopSimulator(udid: string): Promise<void> {
    try {
      await exec(`xcrun simctl shutdown ${udid}`);
    } catch (error) {
      // Simulator might already be stopped
      console.warn(
        `Warning: Could not stop simulator ${udid}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Reset a simulator to factory state
   */
  async resetSimulator(udid: string): Promise<void> {
    try {
      await exec(`xcrun simctl erase ${udid}`);
    } catch (error) {
      throw new Error(`Failed to reset simulator: ${(error as Error).message}`);
    }
  }

  /**
   * Wait for simulator to be ready
   */
  async waitForSimulator(udid: string, timeout: number = 60000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const { stdout } = await exec(`xcrun simctl list devices ${udid}`);
        if (stdout.includes("(Booted)")) {
          // Additional wait for UI to be ready
          await new Promise((resolve) => setTimeout(resolve, 3000));
          return;
        }
      } catch (error) {
        // Continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`Simulator ${udid} failed to boot within ${timeout}ms`);
  }

  /**
   * Install app on device
   */
  async installApp(ipaPath: string, udid?: string): Promise<void> {
    try {
      const deviceArg = udid ? `--device ${udid}` : "";
      await exec(
        `xcrun devicectl device install app ${deviceArg} "${ipaPath}"`,
      );
    } catch (error) {
      // Fallback to legacy method for simulators
      try {
        const targetUdid = udid || this.currentDevice?.udid;
        if (targetUdid) {
          await exec(`xcrun simctl install ${targetUdid} "${ipaPath}"`);
        } else {
          throw new Error(
            "No device specified and no current device available",
          );
        }
      } catch (legacyError) {
        throw new Error(`Failed to install app: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Uninstall app from device
   */
  async uninstallApp(bundleId: string, udid?: string): Promise<void> {
    try {
      const targetUdid = udid || this.currentDevice?.udid;
      if (!targetUdid) {
        throw new Error("No device specified and no current device available");
      }

      await exec(`xcrun simctl uninstall ${targetUdid} ${bundleId}`);
    } catch (error) {
      throw new Error(`Failed to uninstall app: ${(error as Error).message}`);
    }
  }

  /**
   * Get current device
   */
  getCurrentDevice(): Device | null {
    return this.currentDevice;
  }

  /**
   * Set current device
   */
  setCurrentDevice(device: Device): void {
    this.currentDevice = device;
  }

  /**
   * Check if Xcode tools are available
   */
  async checkXcodeTools(): Promise<boolean> {
    try {
      await exec("xcrun --version");
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available device types
   */
  async getDeviceTypes(): Promise<string[]> {
    try {
      const { stdout } = await exec("xcrun simctl list devicetypes --json");
      const data = JSON.parse(stdout);
      return data.devicetypes.map((dt: any) => dt.name);
    } catch (error) {
      return [
        "iPhone 15 Pro",
        "iPhone 15",
        "iPhone 14 Pro",
        "iPhone 14",
        "iPad Pro (11-inch)",
        "iPad Air",
      ];
    }
  }

  /**
   * Get available iOS runtimes
   */
  async getiOSRuntimes(): Promise<string[]> {
    try {
      const { stdout } = await exec("xcrun simctl list runtimes --json");
      const data = JSON.parse(stdout);
      return data.runtimes
        .filter((rt: any) => rt.name.includes("iOS"))
        .map((rt: any) => rt.identifier);
    } catch (error) {
      return ["iOS-17-0", "iOS-16-4", "iOS-15-5"];
    }
  }

  /**
   * Clean up all test simulators
   */
  async cleanupTestSimulators(): Promise<void> {
    try {
      const simulators = await this.getSimulators();
      const testSimulators = simulators.filter((sim) =>
        sim.name.startsWith("TestDevice-"),
      );

      for (const sim of testSimulators) {
        try {
          await this.stopSimulator(sim.udid);
          await exec(`xcrun simctl delete ${sim.udid}`);
          console.log(`Cleaned up test simulator: ${sim.name}`);
        } catch (error) {
          console.warn(
            `Failed to cleanup simulator ${sim.name}: ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      console.warn(
        `Failed to cleanup test simulators: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get device logs
   */
  async getDeviceLogs(udid?: string, filter?: string): Promise<string> {
    try {
      const targetUdid = udid || this.currentDevice?.udid;
      if (!targetUdid) {
        throw new Error("No device specified and no current device available");
      }

      const filterArg = filter ? `--predicate "${filter}"` : "";
      const { stdout } = await exec(
        `xcrun simctl spawn ${targetUdid} log stream ${filterArg} --timeout 5`,
      );
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get device logs: ${(error as Error).message}`);
    }
  }
}
