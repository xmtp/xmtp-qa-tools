import { getActiveVersion } from "@helpers/versions";

// Fork matrix parameters - shared between test and CLI
export const groupCount = 5;
export const parallelOperations = 5; // How many operations to perform in parallel
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
  createInstallation: true, // creates a new installation for a random worker
  sendMessage: true, // sends a message to the group
};
export const targetEpoch = 150n; // The target epoch to stop the test (epochs are when performing forks to the group)
export const network = process.env.XMTP_ENV; // Network environment setting
export const randomInboxIdsCount = 10; // How many inboxIds to use randomly in the add/remove operations
export const installationCount = 2; // How many installations to use randomly in the createInstallation operations
export const testName = "forks";

// Network chaos configuration
export type ChaosLevel = "low" | "medium" | "high";

export interface ChaosPreset {
  delayMin: number; // Minimum delay in ms
  delayMax: number; // Maximum delay in ms
  jitterMin: number; // Minimum jitter in ms
  jitterMax: number; // Maximum jitter in ms
  lossMin: number; // Minimum packet loss percentage (0-100)
  lossMax: number; // Maximum packet loss percentage (0-100)
  interval: number; // How often to apply chaos in ms
}

export const chaosPresets: Record<ChaosLevel, ChaosPreset> = {
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
    delayMin: 100,
    delayMax: 500,
    jitterMin: 0,
    jitterMax: 100,
    lossMin: 0,
    lossMax: 5,
    interval: 10000, // 10 seconds
  },
};

export interface ChaosConfig {
  enabled: boolean;
  level: ChaosLevel;
}

// Parse chaos config from environment
export const chaosConfig: ChaosConfig = {
  enabled: process.env.CHAOS_ENABLED === "true",
  level: (process.env.CHAOS_LEVEL as ChaosLevel) || "medium",
};

// Multinode container names for local environment chaos testing
export const multinodeContainers = [
  "multinode-node1-1",
  "multinode-node2-1",
  "multinode-node3-1",
  "multinode-node4-1",
];
