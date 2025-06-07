import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { playwright } from "@helpers/playwright";
import {
  getInbox,
  getInboxIds,
  getRandomInboxIds,
  sleep,
} from "@helpers/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "gm";
loadEnv(testName);

describe(testName, () => {
  let groupId: string;
  const network = "production";
  const headless = false;
  let xmtpTester: playwright;
  let creator: Worker;
  let gmBot: Worker;
  const inbox = getInbox(1)[0];
  beforeAll(async () => {
    xmtpTester = new playwright({
      headless,
      env: network,
      defaultUser: inbox,
    });
    await xmtpTester.startPage();
    const convoStreamBot = await getWorkers(
      ["bob"],
      testName,
      typeofStream.None,
      typeOfResponse.None,
      typeOfSync.None,
      "production",
    );
    const gmAliceBot = await getWorkers(["alice"], testName);

    creator = convoStreamBot.get("bob") as Worker;
    gmBot = gmAliceBot.get("alice") as Worker;
  });

  it("should test added to group ", async () => {
    try {
      const newGroup = await creator.client.conversations.newGroup(
        getRandomInboxIds(4),
      );
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

  it("should create a group and send a message", async () => {
    try {
      groupId = await xmtpTester.newGroupFromUI([
        ...getInboxIds(4),
        gmBot.address,
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
      await xmtpTester.addMemberToGroup(groupId, creator.inboxId);
      await sleep(2000);
    } catch (e) {
      await xmtpTester.takeSnapshot("gm-group");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should respond to a message", async () => {
    try {
      const xmtpNewTester = new playwright({
        headless,
        env: network,
      });
      await xmtpNewTester.startPage();

      await xmtpNewTester.newDmFromUI(gmBot.address);
      await xmtpNewTester.sendMessage("hi");
      await xmtpNewTester.waitForResponse(["gm"]);
    } catch (error) {
      console.error("Error in browser test:", error);
      throw error;
    }
  });
});
