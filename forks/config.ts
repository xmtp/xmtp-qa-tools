import { type DbChaosConfig } from "@chaos/db";
import { type ExpandGroupConfig } from "@chaos/expand";
import type { NetworkChaosConfig } from "@chaos/network";
import type { StreamsConfig } from "@chaos/streams";
import { getActiveVersion, type XmtpEnv } from "@helpers/versions";

export const NODE_VERSION = getActiveVersion().nodeBindings; // default to latest version, can be overridden with --nodeBindings=3.1.1
// By calling workers with prefix random1, random2, etc. we guarantee that creates a new key each run
// We want to create a key each run to ensure the forks are "pure"
export const workerNames = [
  "random1",
  "random2",
  "random3",
  "random4",
  "random5",
] as string[];

// Operations configuration - enable/disable specific operations
export const epochRotationOperations = {
  updateName: true, // updates the name of the group
  addMember: true, // adds a random member to the group
  removeMember: true, // removes a random member from the group
};
export const otherOperations = {
  createInstallation: false, // creates a new installation for a random worker
  sendMessage: true, // sends a message to the group
  sync: true, // syncs the group
};
export const randomInboxIdsCount = 50; // How many inboxIds to use randomly in the add/remove operations
export const installationCount = 2; // How many installations to use randomly in the createInstallation operations
export const maxConsecutiveFailures = 5; // Maximum number of times we throw an error verifying the results of a batch of operations
export const testName = "forks";

// Network chaos configuration
export type NetworkChaosLevel = "none" | "low" | "medium" | "high";

export const networkChaosPresets: Record<
  Exclude<NetworkChaosLevel, "none">,
  NetworkChaosConfig
> = {
  low: {
    delayMin: 50,
    delayMax: 150,
    jitterMin: 0,
    jitterMax: 50,
    lossMin: 0,
    lossMax: 2,
    interval: 15000, // 15 seconds
  },
  medium: {
    delayMin: 100,
    delayMax: 300,
    jitterMin: 0,
    jitterMax: 75,
    lossMin: 0,
    lossMax: 3.5,
    interval: 10000, // 10 seconds
  },
  high: {
    delayMin: 0,
    delayMax: 500,
    jitterMin: 50,
    jitterMax: 200,
    lossMin: 0,
    lossMax: 25,
    interval: 10000, // 10 seconds
  },
};

// Database chaos configuration
export type DbChaosLevel = "none" | "low" | "medium" | "high";

export const dbChaosPresets: Record<
  Exclude<DbChaosLevel, "none">,
  DbChaosConfig
> = {
  low: {
    minLockTime: 50,
    maxLockTime: 250,
    lockInterval: 10000, // 10 seconds
    impactedWorkerPercentage: 20,
  },
  medium: {
    minLockTime: 100,
    maxLockTime: 2000,
    lockInterval: 15000, // 15 seconds
    impactedWorkerPercentage: 40,
  },
  high: {
    minLockTime: 500,
    maxLockTime: 2000,
    lockInterval: 5000, // 5 seconds
    impactedWorkerPercentage: 60,
  },
};

// Helper functions to get chaos configs
export function resolveNetworkChaosConfig(
  networkChaosLevel: NetworkChaosLevel,
): NetworkChaosConfig | null {
  if (networkChaosLevel === "none") return null;
  if (!networkChaosPresets[networkChaosLevel]) {
    throw new Error(`Invalid network chaos level: ${networkChaosLevel}`);
  }
  return networkChaosPresets[networkChaosLevel];
}

export function resolveDbChaosConfig(
  dbChaosLevel: DbChaosLevel,
): DbChaosConfig | null {
  if (dbChaosLevel === "none") return null;
  if (!dbChaosPresets[dbChaosLevel]) {
    throw new Error(`Invalid DB chaos level: ${dbChaosLevel}`);
  }

  return dbChaosPresets[dbChaosLevel];
}

// Multinode container names for local environment chaos testing
export const multinodeContainers = [
  "multinode-node1-1",
  "multinode-node2-1",
  "multinode-node3-1",
  "multinode-node4-1",
  // Include the MLS validation service to add some additional chaos
  "multinode-validation-1",
];

/**
 * The config flags that are passed in as JSON from the environment
 */
export type RuntimeConfig = {
  groupCount: number; // Number of groups to run the test against
  parallelOperations: number; // Number of parallel operations run on each group
  targetEpoch: number; // Target epoch to stop the test at
  network: XmtpEnv; // XMTP network
  networkChaos: NetworkChaosConfig | null; // Network chaos configuration
  dbChaos: DbChaosConfig | null; // Database chaos configuration
  backgroundStreams: StreamsConfig | null; // Background streams configuration
  groupExpansion: ExpandGroupConfig | null;
};

export function getConfigFromEnv(): RuntimeConfig {
  const jsonString = process.env.FORK_TEST_CONFIG;
  if (!jsonString) {
    throw new Error("FORK_TEST_CONFIG environment variable is not set");
  }

  return JSON.parse(jsonString) as RuntimeConfig;
}

/**
 * Pretty-print the complete runtime configuration
 */
export function printConfig(config: RuntimeConfig): void {
  console.info("\nFORK MATRIX PARAMETERS");
  console.info("-".repeat(60));
  console.info(`groupCount: ${config.groupCount}`);
  console.info(`parallelOperations: ${config.parallelOperations}`);
  console.info(`NODE_VERSION: ${NODE_VERSION}`);
  console.info(`workerNames: [${workerNames.join(", ")}]`);
  console.info(
    `epochRotationOperations: ${JSON.stringify(epochRotationOperations)}`,
  );
  console.info(`otherOperations: ${JSON.stringify(otherOperations)}`);
  console.info(`targetEpoch: ${config.targetEpoch}`);
  console.info(`network: ${config.network}`);
  console.info(`randomInboxIdsCount: ${randomInboxIdsCount}`);
  console.info(`installationCount: ${installationCount}`);
  console.info(`testName: ${testName}`);
  console.info(
    `backgroundStreams: ${config.backgroundStreams ? "enabled" : "disabled"}. From separate client instances: ${config.backgroundStreams?.cloned}`,
  );

  if (config.networkChaos) {
    console.info("\nNETWORK CHAOS PARAMETERS");
    console.info(
      `  delay: ${config.networkChaos.delayMin}-${config.networkChaos.delayMax}ms`,
    );
    console.info(
      `  jitter: ${config.networkChaos.jitterMin}-${config.networkChaos.jitterMax}ms`,
    );
    console.info(
      `  packetLoss: ${config.networkChaos.lossMin}-${config.networkChaos.lossMax}%`,
    );
    console.info(`  interval: ${config.networkChaos.interval}ms`);
  }

  if (config.dbChaos) {
    console.info("\nDATABASE CHAOS PARAMETERS");
    console.info(
      `  lockDuration: ${config.dbChaos.minLockTime}-${config.dbChaos.maxLockTime}ms`,
    );
    console.info(`  interval: ${config.dbChaos.lockInterval}ms`);
  }

  console.info("-".repeat(60) + "\n");
}
