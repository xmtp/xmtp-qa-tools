import newInboxes2 from "./byinstallation/2.json";
import newInboxes5 from "./byinstallation/5.json";
import newInboxes10 from "./byinstallation/10.json";
import newInboxes15 from "./byinstallation/15.json";
import newInboxes20 from "./byinstallation/20.json";
import newInboxes25 from "./byinstallation/25.json";
import newInboxes30 from "./byinstallation/30.json";

// Type definitions for inbox data
export interface InboxData {
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

function getInboxByInstallationCount(
  installationCount: number,
  index: number = 200,
) {
  if (installationCount === 2) {
    return typedInboxes2.slice(0, index);
  } else if (installationCount === 5) {
    return typedInboxes5.slice(0, index);
  } else if (installationCount === 10) {
    return typedInboxes10.slice(0, index);
  } else if (installationCount === 15) {
    return typedInboxes15.slice(0, index);
  } else if (installationCount === 20) {
    return typedInboxes20.slice(0, index);
  } else if (installationCount === 25) {
    return typedInboxes25.slice(0, index);
  } else if (installationCount === 30) {
    return typedInboxes30.slice(0, index);
  }
  return typedInboxes2;
}

export function getInboxes(count: number, installationCount: number = 2) {
  const pool = getInboxByInstallationCount(installationCount);
  return pool
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((inbox) => inbox);
}
