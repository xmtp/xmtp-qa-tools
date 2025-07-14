import newInboxes2 from "./2.json";
import newInboxes5 from "./5.json";
import newInboxes10 from "./10.json";
import newInboxes15 from "./15.json";
import newInboxes20 from "./20.json";
import newInboxes25 from "./25.json";
import newInboxes30 from "./30.json";

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
export function getRandomInbox() {
  const pool = getInboxByInstallationCount(2).slice(0, 200);
  return pool[Math.floor(Math.random() * pool.length)];
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
  const pool = getInboxByInstallationCount(installationCount).slice(0, 200);
  return pool
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((inbox) => inbox.inboxId);
}

export function getInboxIds(count: number) {
  return getInboxByInstallationCount(2)
    .slice(0, 200)
    .slice(0, count)
    .map((inbox) => inbox.inboxId);
}
export function getAddresses(count: number) {
  return getInboxByInstallationCount(2)
    .slice(0, 200)
    .slice(0, count)
    .map((inbox) => inbox.accountAddress);
}
