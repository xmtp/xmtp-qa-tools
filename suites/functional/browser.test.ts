import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { playwright } from "@helpers/playwright";
import {
  getFixedNames,
  getInbox,
  getInboxIds,
  GM_BOT_ADDRESS,
} from "@helpers/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "browser";
loadEnv(testName);

describe(testName, () => {
  const headless = true;
  const network = "production";
  it("should test added to group ", async () => {
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
  });

  it("should respond to a message", async () => {
    const xmtpTester = new playwright({
      headless,
      env: network,
    });
    await xmtpTester.startPage();
    try {
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
      const xmtpTester = new playwright({
        headless,
        env: network,
      });
      await xmtpTester.startPage();
      const slicedInboxes = getInboxIds(4);
      const groupId = await xmtpTester.newGroupFromUI([
        ...slicedInboxes,
        GM_BOT_ADDRESS,
      ]);
      console.debug(groupId);
      await xmtpTester.sendMessage("hi");
      await xmtpTester.waitForResponse(["gm"]);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
