import { defaultNames, loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { getWorkers, type Worker } from "@workers/manager";
import { describe, expect, it } from "vitest";

const users: {
  [key: string]: {
    inboxId: string;
  };
} = {
  // cb: {
  //   inboxId: "705c87a99e87097ee2044aec0bdb4617634e015db73900453ad56a7da80157ff",
  //
  // },
  // convos: {
  //   inboxId: "7b7eefbfb80e019656b6566101d6903ec8cf5494e2d6ae5ef0a4c4c886d86a47",
  //
  // },
  xmtpchat: {
    inboxId: "a4e97a970fbe76a2189fc340182aa7f605e5dcb66f4ff8f22b74c489ee8b1d26",
  },
};

const testName = "bug_stitch";
loadEnv(testName);

describe(testName, () => {
  const randomName =
    defaultNames[Math.floor(Math.random() * defaultNames.length)];
  for (const user of Object.keys(users)) {
    describe(`User: ${user}`, () => {
      let randomWorker: Worker;
      const receiver = users[user].inboxId;

      it("should initialize clients and sync conversations", async () => {
        try {
          console.log(`Setting up test for ${user}`);
          const workers = await getWorkers([randomName], testName);
          randomWorker = workers.get(randomName) as Worker;
          const newConvo =
            await randomWorker.client.conversations.newDm(receiver);

          console.log("sending message");
          const message = "message 1/3\n" + "convoId: " + String(newConvo.id);
          await newConvo?.send(message);
        } catch (e) {
          logError(e, expect.getState().currentTestName);
          throw e;
        }
      });

      it("should create new DM and group conversations", async () => {
        try {
          console.log(`Setting up test for ${user}`);
          const workers = await getWorkers([randomName + "-b"], testName);
          randomWorker = workers.get(randomName, "b") as Worker;
          const sender = randomWorker?.client;
          const newConvo = await sender.conversations.newDm(receiver);

          console.log("sending message");
          const message = "message 2/3\n" + "convoId: " + String(newConvo.id);
          await newConvo?.send(message);
        } catch (e) {
          logError(e, expect.getState().currentTestName);
          throw e;
        }
      });
      it("terminate and restart", async () => {
        // Simulate termination and restart
        console.warn(" terminates, deletes local data, and restarts");
        await randomWorker?.worker?.clearDB();
        await randomWorker?.worker?.initialize();
      });
      it("should create new DM and group conversations", async () => {
        try {
          console.log(`Setting up test for ${user}`);
          const workers = await getWorkers([randomName + "-c"], testName);
          randomWorker = workers.get(randomName, "c") as Worker;
          const sender = randomWorker?.client;
          const newConvo = await sender.conversations.newDm(receiver);

          console.log("sending message");
          const message = "message 3/3\n" + "convoId: " + String(newConvo.id);
          await newConvo?.send(message);
        } catch (e) {
          logError(e, expect.getState().currentTestName);
          throw e;
        }
      });
    });
  }
});
