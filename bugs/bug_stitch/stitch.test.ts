import { closeEnv, loadEnv } from "@helpers/client";
import type { XmtpEnv } from "@helpers/types";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, it } from "vitest";

const users: {
  [key: string]: {
    inboxId: string;
    env: string;
  };
} = {
  cb: {
    inboxId: "705c87a99e87097ee2044aec0bdb4617634e015db73900453ad56a7da80157ff",
    env: "production",
  },
  // convos: {
  //   inboxId: "7b7eefbfb80e019656b6566101d6903ec8cf5494e2d6ae5ef0a4c4c886d86a47",
  //   env: "dev",
  // },
  // xmtpchat: {
  //   inboxId: "14b8fcaf1e5df82fd7f27d039b641d34116c440e964f313cf87cffb0e84e0105",
  //   env: "dev",
  // },
};

const testName = "bug_stitch";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;

  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  for (const user of Object.keys(users)) {
    it("should create duplicate conversations when  client restarts", async () => {
      console.log(`Running test for ${user}[${users[user].env}]`);
      //Step 1: Create workers
      workers = await getWorkers(
        ["ivy-a-100", "ivy-b-104"],
        testName,
        "message",
        false,
        undefined,
        users[user].env as XmtpEnv,
      );
      const ivy100 = workers.get("ivy", "a");
      const ivy104 = workers.get("ivy", "b");

      //Step 2: Sync all
      console.log("syncing all");
      await ivy100?.client.conversations.syncAll();

      //Step 3: Create new DM
      const newConvo = await ivy100?.client.conversations.newDm(
        users[user].inboxId,
      );
      const originalConvoId = newConvo?.id;

      //Step 4: Send message
      console.log("sending message");
      const message = "message 1/3\n" + "convoId: " + String(originalConvoId);
      await newConvo?.send(message);

      //Step 5: Terminate and restart
      console.warn("Ivy terminates, deletes local data, and restarts");
      await ivy100?.worker.clearDB();
      await ivy100?.worker.initialize();

      //Step 6: Create new DM - this should ideally reuse the same conversation
      const newConvo2 = await ivy100?.client.conversations.newDm(
        users[user].inboxId,
      );
      const recreatedConvoId = newConvo2?.id;

      // Add verification
      console.log(`Original conversation ID: ${originalConvoId}`);
      console.log(`Recreated conversation ID: ${recreatedConvoId}`);
      // Check if IDs match - if they don't, it means a duplicate was created

      //Step 7: Send message
      const message2 = "message 2/3\n" + "convoId: " + String(recreatedConvoId);
      await newConvo2?.send(message2);

      // To match your specific flow, we might want to check if sending works
      // and then move to ivy104 only if sending doesn't work

      //104
      //Step 7: Create new DM from 104
      const newConvo3 = await ivy104?.client.conversations.newDm(
        users[user].inboxId,
      );
      const convo104Id = newConvo3?.id;
      console.log(`ivy-104 conversation ID: ${convo104Id}`);

      //Step 8: Send message
      const message3 = "message 3/3\n" + "convoId: " + String(convo104Id);
      await newConvo3?.send(message3);

      //Terminate all workers
      await workers.terminateAll();
    });
  }
});
