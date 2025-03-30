import { closeEnv, loadEnv } from "@helpers/client";
import type { XmtpEnv } from "@helpers/types";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, it } from "vitest";

/*STICHED IN CB*/

/*WALLET_KEY_BOB=0xdfc5794cff143b45a3761da068265eef21d1047107a2d071a338d0e08b310757
ENCRYPTION_KEY_BOB=21f49e58d51c4685ebece1b210c8606425558bcd3597aba74cc6d4c84e7bdba5
# public key is 0x45Cff2AC00FEF93e90f365F13E8c35382B20722B

WALLET_KEY_ALICE=0x6f1492016ec6a6265b301ba14ee2da88ea6ab91a5c73a5b24aa1923e0149b7b2
ENCRYPTION_KEY_ALICE=08b3fc095cfb0d49bb0b53402e2b25ab679cfe4c604ad7827714fbd3ca0bae75
# public key is 0xD23bfB28265A1E9DA6A4967F0F5DE99980a1ddA2
*/
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
  convos: {
    inboxId: "7b7eefbfb80e019656b6566101d6903ec8cf5494e2d6ae5ef0a4c4c886d86a47",
    env: "dev",
  },
  xmtpchat: {
    inboxId: "7b7eefbfb80e019656b6566101d6903ec8cf5494e2d6ae5ef0a4c4c886d86a47",
    env: "dev",
  },
};

const testName = "bug_stitch";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("should create duplicate conversations when web client restarts", async () => {
    for (const user of Object.keys(users)) {
      //Step 1: Create workers
      workers = await getWorkers(
        ["ivy-100-100", "ivy-104-104"],
        testName,
        "message",
        false,
        undefined,
        users[user].env as XmtpEnv,
      );
      const ivy100 = workers.get("ivy", "100");
      const ivy104 = workers.get("ivy", "104");

      //Step 2: Sync all
      console.log("syncing all");
      await ivy100?.client.conversations.syncAll();

      //Step 3: Create new DM
      const newConvo = await ivy100?.client.conversations.newDm(
        users[user].inboxId,
      );

      //Step 4: Send message
      console.log("sending message");
      const message = "gm from ivy-a100" + (newConvo?.id || "");
      await newConvo?.send(message);

      //Step 5: Terminate and restart
      console.warn("Ivy  terminates, deletes local data, and restarts");
      await ivy100?.worker.clearDB();
      await ivy100?.worker.initialize();

      //Step 6: Create new DM
      const newConvo2 = await ivy100?.client.conversations.newDm(
        users[user].inboxId,
      );
      const message2 = "gm from ivy-a100 " + (newConvo2?.id || "");
      console.log(message2);
      await newConvo2?.send(message2);

      //104

      //Step 7: Create new DM from 104
      const newConvo3 = await ivy104?.client.conversations.newDm(
        users[user].inboxId,
      );
      const message3 = "gm from ivy-a104 " + (newConvo3?.id || "");
      console.log(message3);
      await newConvo3?.send(message3);
    }
  });
});
