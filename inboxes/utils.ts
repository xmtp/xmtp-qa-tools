import fs from "fs";
import path from "path";
import newInboxes2 from "./byinstallation/2.json";
import newInboxes5 from "./byinstallation/5.json";
import newInboxes10 from "./byinstallation/10.json";
import newInboxes15 from "./byinstallation/15.json";
import newInboxes20 from "./byinstallation/20.json";
import newInboxes25 from "./byinstallation/25.json";
import newInboxes30 from "./byinstallation/30.json";

// Type definitions for inbox data
interface InboxData {
  accountAddress: string;
  walletKey: string;
  dbEncryptionKey: string;
  inboxId: string;
  installations: number;
}

const typedInboxes2 = newInboxes2 as InboxData[];
const typedInboxes5 = newInboxes5 as InboxData[];
const typedInboxes10 = newInboxes10 as InboxData[];
const typedInboxes20 = newInboxes20 as InboxData[];
const typedInboxes25 = newInboxes25 as InboxData[];
const typedInboxes15 = newInboxes15 as InboxData[];
const typedInboxes30 = newInboxes30 as InboxData[];

export function getInboxByInstallationCount(
  installationCount: number,
  index?: number,
) {
  if (installationCount === 2) {
    return index !== undefined ? typedInboxes2.slice(0, index) : typedInboxes2;
  } else if (installationCount === 5) {
    return index !== undefined ? typedInboxes5.slice(0, index) : typedInboxes5;
  } else if (installationCount === 10) {
    return index !== undefined
      ? typedInboxes10.slice(0, index)
      : typedInboxes10;
  } else if (installationCount === 15) {
    return index !== undefined
      ? typedInboxes15.slice(0, index)
      : typedInboxes15;
  } else if (installationCount === 20) {
    return index !== undefined
      ? typedInboxes20.slice(0, index)
      : typedInboxes20;
  } else if (installationCount === 25) {
    return index !== undefined
      ? typedInboxes25.slice(0, index)
      : typedInboxes25;
  } else if (installationCount === 30) {
    return index !== undefined
      ? typedInboxes30.slice(0, index)
      : typedInboxes30;
  }
  return typedInboxes2;
}

export function getRandomInboxIdsWithRandomInstallations(count: number) {
  let totalInboxes = [];
  const possibleInstallations = [2, 5, 10, 15, 20, 25, 30];
  for (let i = 0; i < count; i++) {
    let inboxes = getInboxByInstallationCount(
      possibleInstallations[
        Math.floor(Math.random() * possibleInstallations.length)
      ],
    );
    let whichRandom = Math.floor(Math.random() * inboxes.length);
    totalInboxes.push(inboxes[whichRandom]);
  }
  return totalInboxes.map((inbox) => inbox.inboxId);
}
export function getRandomInboxIds(
  count: number,
  installationCount: number = 2,
) {
  const pool = getInboxByInstallationCount(installationCount);
  return pool
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((inbox) => inbox.inboxId);
}
export function getRandomAddress(count: number, installationCount: number = 2) {
  const pool = getInboxByInstallationCount(installationCount);
  return pool
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((inbox) => inbox.accountAddress);
}

export function getInboxIds(count: number) {
  return getInboxByInstallationCount(2)
    .slice(0, count)
    .map((inbox) => inbox.inboxId);
}
export function getAddresses(count: number) {
  return getInboxByInstallationCount(2)
    .slice(0, count)
    .map((inbox) => inbox.accountAddress);
}

/**
 * Get bysize worker names from bysize.json
 * @returns Array of bysize worker names (e.g., ["bysize500", "bysize1000", ...])
 */
export function getBysizeWorkerNames(): string[] {
  try {
    const bysizePath = path.resolve(
      process.cwd(),
      "inboxes",
      "bysize",
      "bysize.json",
    );
    const bysizeData = JSON.parse(
      fs.readFileSync(bysizePath, "utf8"),
    ) as Array<{
      size: number;
    }>;

    return bysizeData.map((item) => `bysize${item.size}`);
  } catch (error) {
    console.debug("Failed to load bysize worker names:", error);
    return [];
  }
}

/**
 * Get bysize worker name for a specific size
 * @param size The size to look for
 * @returns The bysize worker name or null if not found
 */
export function getBysizeWorkerName(size: number): string | null {
  try {
    const bysizePath = path.resolve(
      process.cwd(),
      "inboxes",
      "bysize",
      "bysize.json",
    );
    const bysizeData = JSON.parse(
      fs.readFileSync(bysizePath, "utf8"),
    ) as Array<{
      size: number;
    }>;

    const entry = bysizeData.find((item) => item.size === size);
    return entry ? `bysize${size}` : null;
  } catch (error) {
    console.debug(`Failed to get bysize worker name for size ${size}:`, error);
    return null;
  }
}
