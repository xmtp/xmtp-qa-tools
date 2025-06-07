import { loadEnv } from "@helpers/client";
import { playwright } from "@helpers/playwright";
import {
  getFixedNames,
  getInbox,
  getInboxIds,
  GM_BOT_ADDRESS,
  sleep,
} from "@helpers/utils";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type XmtpEnv } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "browser";
loadEnv(testName);

describe(testName, () => {
  it("should test added to group ", async () => {
    const inbox = getInbox(1)[0];
    const xmtpTester = new playwright({
      headless: false,
      env: "production",
      defaultUser: inbox,
    });
    await xmtpTester.startPage();
    const workers = await getWorkers(getFixedNames(4), testName, {
      env: "production",
    } as XmtpEnv);
    const newGroup = await workers.createGroup();
    console.debug(JSON.stringify(inbox, null, 2));
    await newGroup.send("hi");
    await newGroup.addMembers([inbox.inboxId]);
    await sleep(2000);
    await newGroup.addMembers([inbox.inboxId]);
    await xmtpTester.waitForNewConversation();
    await sleep(2000);
  });

  // it("should respond to a message", async () => {
  // const xmtpTester = new playwright({
  //   headless: true,
  //   env: "production",
  // });
  // await xmtpTester.startPage();
  //   try {
  //     await xmtpTester.newDmFromUI(GM_BOT_ADDRESS);
  //     await xmtpTester.sendMessage("hi");
  //     await xmtpTester.waitForResponse(["gm"]);
  //   } catch (error) {
  //     console.error("Error in browser test:", error);
  //     throw error;
  //   }
  // });

  // it("should create a group and send a message", async () => {
  //   try {
  //     const slicedInboxes = getInboxIds(4);
  //     await xmtpTester.newGroupFromUI([...slicedInboxes, GM_BOT_ADDRESS]);
  //     await xmtpTester.sendMessage("hi");
  //     await xmtpTester.waitForResponse(["gm"]);
  //   } catch (e) {
  //     logError(e, expect.getState().currentTestName);
  //     throw e;
  //   }
  // });
});
