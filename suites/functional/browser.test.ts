import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { playwright } from "@helpers/playwright";
import {
  getFixedNames,
  getInbox,
  getInboxIds,
  GM_BOT_ADDRESS,
} from "@helpers/utils";
import { getWorkers } from "@workers/manager";
import { IdentifierKind } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "browser";
loadEnv(testName);

describe(testName, () => {
  it("should test added to group ", async () => {
    const xmtpTester = new playwright({
      headless: true,
      env: "production",
      defaultUser: getInbox(1)[0],
    });
    await xmtpTester.startPage();
    const workers = await getWorkers(getFixedNames(4), testName);
    const newGroup = await workers.createGroup();

    await newGroup.addMembersByIdentifiers([
      {
        identifier: "0x8314682f55688294ea5bf1940ce3612f02872820",
        identifierKind: IdentifierKind.Ethereum,
      },
    ]);
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
