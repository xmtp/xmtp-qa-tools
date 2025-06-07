import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { playwright } from "@helpers/playwright";
import {
  getFixedNames,
  getInbox,
  getInboxIds,
  GM_BOT_ADDRESS,
  sleep,
} from "@helpers/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "browser";
loadEnv(testName);

describe(testName, () => {
  let groupId: string;
  const network = "production";
  const defaultInbox = getInbox(1)[0];
  const headless = true;
  const defaultTester = new playwright({
    headless,
    env: network,
    defaultUser: defaultInbox,
  });

  it("should test added to group ", async () => {
    try {
      const inbox = getInbox(1)[0];
      const xmtpTester = new playwright({
        headless,
        env: network,
        defaultUser: inbox,
      });
      await xmtpTester.startPage();
      const workers = await getWorkers(
        getFixedNames(4),
        testName,
        typeofStream.None,
        typeOfResponse.None,
        typeOfSync.None,
        "production",
      );
      const newGroup = await workers.createGroup();
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
      await defaultTester.startPage();
      const slicedInboxes = getInboxIds(4);
      groupId = await defaultTester.newGroupFromUI([
        ...slicedInboxes,
        GM_BOT_ADDRESS,
      ]);
      await defaultTester.sendMessage("hi");
      await defaultTester.waitForResponse(["gm"]);
    } catch (e) {
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

      await defaultTester.addMemberToGroup(
        groupId,
        workers.get("bot")?.inboxId ?? "",
      );
      await sleep(2000);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
