import { existsSync } from "fs";

export function loadEnvFile() {
  // Only do this in the gm example because it's called from the root
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  } else if (existsSync(`../../.env`)) {
    process.loadEnvFile(`../../.env`);
  }
}

export function shouldSkipOldMessage(
  messageTimestamp: number,
  startupTimestamp: number,
  skippedCount: { count: number },
  totalConversations: number,
): boolean {
  if (messageTimestamp >= startupTimestamp) {
    return false;
  }

  const ageMs = startupTimestamp - messageTimestamp;
  const ageHours = ageMs / (1000 * 60 * 60);
  const ageDays = ageHours / 24;
  const ageDisplay =
    ageDays >= 1
      ? `${ageDays.toFixed(1)} days`
      : `${ageHours.toFixed(1)} hours`;

  skippedCount.count++;
  console.log(
    `Skipping message because it was sent before startup (${ageDisplay} old, skipped: ${skippedCount.count}) for total conversations: ${totalConversations}`,
  );
  return true;
}

export interface SyncResult {
  startupTimeStamp: number;
  skippedMessagesCount: { count: number };
  totalConversations: any[];
  syncDurationMs: number;
  totalMessages: number;
  dmsCount: number;
  groupsCount: number;
  messageCountDurationMs: number;
}

export async function startUpSync(agent: {
  client: {
    conversations: {
      syncAll: () => Promise<unknown>;
      list: () => Promise<any[]>;
    };
  };
}): Promise<SyncResult> {
  try {
    const startupTimeStamp = new Date().getTime();

    // Time the syncAll operation
    const syncStartTime = performance.now();
    await agent.client.conversations.syncAll();
    const syncEndTime = performance.now();
    const syncDurationMs = syncEndTime - syncStartTime;

    // Get conversations
    const totalConversations = await agent.client.conversations.list();

    // Count messages across all conversations
    const messageCountStartTime = performance.now();
    let totalMessages = 0;
    let dmsCount = 0;
    let groupsCount = 0;

    for (const conversation of totalConversations) {
      try {
        // Check if it's a DM or Group by checking for peerInboxId property
        const isDm = "peerInboxId" in conversation;
        if (isDm) {
          dmsCount++;
        } else {
          groupsCount++;
        }

        // Get messages for this conversation
        const messages = await conversation.messages();
        totalMessages += (messages?.length ?? 0) as number;
      } catch {
        // Silently continue if a conversation fails
      }
    }

    const messageCountEndTime = performance.now();
    const messageCountDurationMs = messageCountEndTime - messageCountStartTime;

    const skippedMessagesCount = { count: 0 };

    return {
      startupTimeStamp,
      skippedMessagesCount,
      totalConversations,
      syncDurationMs,
      totalMessages,
      dmsCount,
      groupsCount,
      messageCountDurationMs,
    };
  } catch (error) {
    console.error("❌ Error syncing conversations:", error);
    throw error;
  }
}

export function logSyncResults(results: SyncResult): void {
  const syncDurationSec = (results.syncDurationMs / 1000).toFixed(2);

  console.log(
    `✅ syncAll completed in ${syncDurationSec}s (${results.syncDurationMs.toFixed(0)}ms)`,
  );
  console.log(
    `   └─ Total conversations: ${results.totalConversations.length}`,
  );
  console.log(`   └─ DMs: ${results.dmsCount}, Groups: ${results.groupsCount}`);
  console.log(`   └─ Total messages: ${results.totalMessages}`);
}
