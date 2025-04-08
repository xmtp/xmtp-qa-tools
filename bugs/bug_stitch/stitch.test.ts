import { loadEnv } from "@helpers/client";
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
    inboxId: "830d9926b1758299ee1279853c2edc387ebd18ca22ef6bea5d2a74dcbbf0e8ac",
  },
};

const testName = "bug_stitch";
loadEnv(testName);

describe(testName, () => {
  for (const user of Object.keys(users)) {
    describe(`User: ${user}`, () => {
      let ivy100: Worker;
      let ivy104: Worker;
      const receiver = users[user].inboxId;

      it("should initialize clients and sync conversations", async () => {
        try {
          console.log(`Setting up test for ${user}`);
          const workers = await getWorkers(
            ["ivy-a-100"],
            testName,
            "message",
            false,
          );
          ivy100 = workers.get("ivy", "a") as Worker;
          console.log("syncing all");
          await ivy100?.client.conversations.sync();
        } catch (e) {
          logError(e, expect);
          throw e;
        }
      });

      it("should create new DM and group conversations", async () => {
        const sender = ivy100?.client;
        try {
          const newConvo = await sender.conversations.newDm(receiver);

          console.log("sending message");
          const message = "message 1/3\n" + "convoId: " + String(newConvo.id);
          await newConvo?.send(message);
        } catch (e) {
          logError(e, expect);
          throw e;
        }
      });
      it("terminate and restart", async () => {
        // Simulate termination and restart
        console.warn("Ivy terminates, deletes local data, and restarts");
        await ivy100?.worker?.clearDB();
        await ivy100?.worker?.initialize();
      });

      it("should create new DM and group conversations", async () => {
        const sender = ivy100?.client;
        try {
          const newConvo = await sender.conversations.newDm(receiver);

          console.log("sending message");
          const message = "message 2/3\n" + "convoId: " + String(newConvo.id);
          await newConvo?.send(message);
        } catch (e) {
          logError(e, expect);
          throw e;
        }
      });
      it("should initialize clients and sync conversations", async () => {
        try {
          console.log(`Setting up test for ${user}]`);
          const workers = await getWorkers(
            ["ivy-b-104"],
            testName,
            "message",
            false,
          );
          ivy104 = workers.get("ivy", "b") as Worker;
          console.log("syncing all");
          await ivy104?.client.conversations.sync();
        } catch (e) {
          logError(e, expect);
          throw e;
        }
      });

      it("should create new DM and group conversations", async () => {
        const sender = ivy104?.client;
        try {
          const newConvo = await sender.conversations.newDm(receiver);

          console.log("sending message");
          const message = "message 3/3\n" + "convoId: " + String(newConvo.id);
          await newConvo?.send(message);
        } catch (e) {
          logError(e, expect);
          throw e;
        }
      });
    });
  }
});
