import { getActiveVersion } from "@workers/node-sdk";

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
export const targetEpoch = 20n; // The target epoch to stop the test (epochs are when performing forks to the group)
export const network = process.env.XMTP_ENV; // Network environment setting
export const randomInboxIdsCount = 10; // How many inboxIds to use randomly in the add/remove operations
export const installationCount = 2; // How many installations to use randomly in the createInstallation operations
export const testName = "forks";
