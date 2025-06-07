import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { playwright } from "@helpers/playwright";
import {
  getInbox,
  getInboxIds,
  getRandomInboxIds,
  GM_BOT_ADDRESS,
  sleep,
} from "@helpers/utils";
import {
  typeOfResponse,
  typeofStream,
  typeOfSync,
  type WorkerClient,
} from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "gm";
loadEnv(testName);

describe(testName, () => {
  let groupId: string;
  const network = "production";
  const headless = true;
  let xmtpTester: playwright;
  let creator: Worker;
  let gmBot: Worker;
  beforeAll(async () => {
    const inbox = getInbox(1)[0];
    xmtpTester = new playwright({
      headless,
      env: network,
      defaultUser: inbox,
    });
    const convoStreamBot = await getWorkers(
      ["bob"],
      testName,
      typeofStream.None,
      typeOfResponse.None,
      typeOfSync.None,
      "production",
    );

    creator = convoStreamBot.get("bob") as Worker;
    const gmAliceBot = await getWorkers(
      ["alice"],
      testName,
      typeofStream.None,
      typeOfResponse.None,
      typeOfSync.None,
      "production",
    );
    gmBot = gmAliceBot.get("alice") as Worker;
  });

  it("should test added to group ", async () => {
    try {
      const inbox = getInbox(1)[0];

      await xmtpTester.startPage();

      const newGroup = await creator.client.conversations.newGroup(
        getRandomInboxIds(4),
      );
      console.debug(JSON.stringify(inbox, null, 2));
      await newGroup.send("hi");
      await newGroup.addMembers([inbox.inboxId]);
      await newGroup.addMembers([inbox.inboxId]);
      console.debug(newGroup.name);
      await xmtpTester.waitForNewConversation(newGroup.name);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should respond to a message", async () => {
    try {
      const xmtpTester = new playwright({
        headless,
        env: network,
      });
      await xmtpTester.startPage();

      await xmtpTester.newDmFromUI(GM_BOT_ADDRESS);
      await xmtpTester.sendMessage("hi");
      await xmtpTester.waitForResponse(["gm"]);
    } catch (error) {
      console.error("Error in browser test:", error);
      throw error;
    }
  });
  it("should create a group and send a message", async () => {
    try {
      await xmtpTester.startPage();
      const slicedInboxes = getInboxIds(4);
      groupId = await xmtpTester.newGroupFromUI([
        ...slicedInboxes,
        GM_BOT_ADDRESS,
      ]);
      await xmtpTester.sendMessage("hi");
      const result = await xmtpTester.waitForResponse(["gm"]);
      expect(result).toBe(true);
    } catch (e) {
      await xmtpTester.takeSnapshot("gm-group");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
  it("add member to group", async () => {
    try {
      const workers = await getWorkers(
        ["bot"],
        testName,
        typeofStream.Conversation,
        typeOfResponse.None,
        typeOfSync.None,
        "production",
      );

      await xmtpTester.addMemberToGroup(
        groupId,
        workers.get("bot")?.inboxId ?? "",
      );
      await sleep(2000);
    } catch (e) {
      await xmtpTester.takeSnapshot("gm-group");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
