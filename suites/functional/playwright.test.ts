import { loadEnv } from "@helpers/client";
import { getTime, logError } from "@helpers/logger";
import { playwright } from "@helpers/playwright";
import {
  getInbox,
  getInboxIds,
  getRandomInboxIds,
  sleep,
} from "@helpers/utils";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "gm";
loadEnv(testName);

describe(testName, () => {
  let groupId: string;
  const receiver = "random";
  const headless = false;
  let xmtpTester: playwright;
  let creator: Worker;
  let gmBot: Worker;
  const inbox = getInbox(1)[0];
  beforeAll(async () => {
    xmtpTester = new playwright({
      headless,
      defaultUser: inbox,
    });
    await xmtpTester.startPage();
    const convoStreamBot = await getWorkers(
      ["bob"],
      testName,
      typeofStream.Conversation,
    );
    const gmBotWorker = await getWorkers(
      [receiver],
      testName,
      typeofStream.Message,
      typeOfResponse.Gm,
    );

    creator = convoStreamBot.get("bob") as Worker;
    gmBot = gmBotWorker.get(receiver) as Worker;
  });

  // it("should receive invite with message", async () => {
  //   try {
  //     const newGroup = await creator.client.conversations.newGroup(
  //       getRandomInboxIds(4),
  //       {
  //         groupName: "Test Group 1 " + getTime(),
  //       },
  //     );
  //     await sleep(1000);
  //     await newGroup.addMembers([inbox.inboxId]);
  //     await newGroup.send(`hi ${receiver}`);
  //     const result = await xmtpTester.waitForNewConversation(newGroup.name);
  //     expect(result).toBe(true);
  //   } catch (e) {
  //     await xmtpTester.takeSnapshot("gm-group");
  //     logError(e, expect.getState().currentTestName);
  //     throw e;
  //   }
  // });

  // it("should receive invite without message", async () => {
  //   try {
  //     const newGroup = await creator.client.conversations.newGroup(
  //       getRandomInboxIds(4),
  //       {
  //         groupName: "Test Group 2 " + getTime(),
  //       },
  //     );
  //     await sleep(1000);
  //     await newGroup.addMembers([inbox.inboxId]);
  //     const result = await xmtpTester.waitForNewConversation(newGroup.name);
  //     expect(result).toBe(true);
  //   } catch (e) {
  //     await xmtpTester.takeSnapshot("gm-group");
  //     logError(e, expect.getState().currentTestName);
  //     throw e;
  //   }
  // });

  // it("should respond to a message", async () => {
  //   try {
  //     await xmtpTester.newDmFromUI(gmBot.address);
  //     await xmtpTester.sendMessage(`hi ${receiver}`);
  //     const result = await xmtpTester.waitForResponse(["gm"]);
  //     expect(result).toBe(true);
  //   } catch (e) {
  //     await xmtpTester.takeSnapshot("gm-group");
  //     logError(e, expect.getState().currentTestName);
  //     throw e;
  //   }
  // });
  it("should create a group and send a message", async () => {
    try {
      groupId = await xmtpTester.newGroupFromUI([
        ...getInboxIds(4),
        gmBot.inboxId,
      ]);
      await xmtpTester.sendMessage(`hi ${receiver}`);
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
      const conversationStream = await creator.client.conversations.stream();
      for await (const conversation of conversationStream) {
        if (conversation?.id === groupId) {
          expect(conversation.id).toBe(groupId);
          break;
        }
      }
      await xmtpTester.addMemberToGroup(groupId, creator.inboxId);

      await sleep(1000);
    } catch (e) {
      await xmtpTester.takeSnapshot("gm-group");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  let xmtpNewTester: playwright;
  it("should respond to a message", async () => {
    try {
      xmtpNewTester = new playwright({
        headless,
      });
      await xmtpNewTester.startPage();

      await xmtpNewTester.newDmFromUI(gmBot.address);
      await xmtpNewTester.sendMessage(`hi ${receiver}`);
      const result = await xmtpNewTester.waitForResponse(["gm"]);
      expect(result).toBe(true);
    } catch (e) {
      await xmtpNewTester.takeSnapshot("gm-group");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
