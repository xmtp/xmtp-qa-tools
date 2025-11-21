import { getVersions, type XmtpEnv } from "@helpers/versions";
import { getWorkers } from "@workers/manager";
import { describe, it } from "vitest";

const testName = "agents-upgrade";

describe(testName, () => {
  const env = (process.env.XMTP_ENV || "dev") as XmtpEnv;
  const versions = getVersions(true).slice(0, 3); // Get first 3 SDK versions

  it(`${testName}: Upgrade 1k conversation DB through 3 SDKs`, async () => {
    const testWorkerName = "upgrade-test";

    console.log(
      `Using SDK versions: ${versions.map((v) => v.nodeBindings).join(" -> ")}`,
    );

    // Step 1: Create initial worker with first SDK version
    console.log(`Step 1: Creating worker with SDK ${versions[0].nodeBindings}`);
    let workers = await getWorkers([testWorkerName], {
      env,
      nodeBindings: versions[0].nodeBindings,
    });
    let worker = workers.get(testWorkerName);
    if (!worker) throw new Error("Worker not created");
    //count pre exsiting convesionations
    console.log("Syncing all conversations...");
    const syncAllStartTime = performance.now();
    await worker!.client.conversations.syncAll();
    const syncAllEndTime = performance.now();
    const syncAllDuration = syncAllEndTime - syncAllStartTime;
    console.log(
      `Sync all conversations duration: ${syncAllDuration.toFixed(2)}ms`,
    );
    const preExistingConversations = await worker!.client.conversations.list();
    const preExistingConversationCount = preExistingConversations.length;
    console.log(
      `Pre existing conversation count: ${preExistingConversationCount} for worker inboxid: ${worker!.address}`,
    );
    //create 1000 new conversations

    //count new conversations
    const postExistingConversations = await worker!.client.conversations.list();
    const postExistingConversationCount = postExistingConversations.length;
    console.log(
      `Post existing conversation count: ${postExistingConversationCount}`,
    );
  });
});
